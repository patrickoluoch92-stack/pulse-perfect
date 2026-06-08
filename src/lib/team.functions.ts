import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceAuthRateLimit, requireMfa } from "@/lib/security";

export const ORG_ROLES = ["owner", "admin", "manager", "staff"] as const;
const orgIdSchema = z.object({ orgId: z.string().uuid() });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    let profiles: Array<{ id: string; full_name: string | null; avatar_url: string | null }> = [];
    if (ids.length) {
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      profiles = rows ?? [];
    }
    return (members ?? []).map((m) => ({
      ...m,
      profile: profiles.find((p) => p.id === m.user_id) ?? null,
    }));
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("organization_invitations")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      email: z.string().trim().toLowerCase().email().max(255),
      role: z.enum(ORG_ROLES),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await enforceAuthRateLimit({ bucket: "invite.create", userId: context.userId, limit: 10, windowSec: 300 });
    const { data: row, error } = await context.supabase
      .from("organization_invitations")
      .upsert(
        { org_id: data.orgId, email: data.email, role: data.role, invited_by: context.userId, accepted_at: null, accepted_by: null },
        { onConflict: "org_id,email" },
      )
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("organization_invitations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), role: z.enum(ORG_ROLES) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    requireMfa(context.claims);
    await enforceAuthRateLimit({ bucket: "member.update", userId: context.userId });
    const { error } = await context.supabase
      .from("organization_members").update({ role: data.role }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    requireMfa(context.claims);
    await enforceAuthRateLimit({ bucket: "member.remove", userId: context.userId });
    const { error } = await context.supabase
      .from("organization_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const getInvitationByToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await (context.supabase as any)
      .rpc("get_invitation_by_token", { _token: data.token });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Invitation not found");
    return row as {
      org_id: string; org_name: string; email: string;
      role: string; expires_at: string; accepted_at: string | null;
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ context, data }) => {
    // Throttle to block brute-force token guessing.
    await enforceAuthRateLimit({ bucket: "invite.accept", userId: context.userId, limit: 15, windowSec: 300 });
    const { data: orgId, error } = await (context.supabase as any)
      .rpc("accept_organization_invitation", { _token: data.token });
    if (error) throw new Error(error.message);
    return { orgId: orgId as string };
  });
