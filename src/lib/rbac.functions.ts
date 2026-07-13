// Server functions for reading and managing RBAC permissions from the client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceAuthRateLimit, requireMfa } from "@/lib/security";
import {
  requireOrgRole,
  isPlatformAdmin,
  type Permission,
} from "@/lib/rbac";

const PERMISSION_KEYS = [
  "bookings.read", "bookings.write", "bookings.refund",
  "pricing.write", "availability.write", "reviews.moderate",
  "finance.read", "finance.payout", "marketing.write",
  "guests.pii.read", "team.invite", "reports.read",
] as const;

/** Returns the effective permission set for the current user in the given org. */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Platform admins get everything.
    if (await isPlatformAdmin({ supabase, userId })) {
      return { permissions: [...PERMISSION_KEYS] as string[], platformAdmin: true };
    }

    // Otherwise resolve each permission via has_permission (single RPC per key —
    // could be batched, but the surface is small).
    const results = await Promise.all(
      PERMISSION_KEYS.map(async (perm) => {
        const { data: ok } = await supabase.rpc("has_permission", {
          _user_id: userId,
          _org_id: data.orgId,
          _permission: perm,
        });
        return ok === true ? perm : null;
      }),
    );
    return {
      permissions: results.filter((x): x is Permission => Boolean(x)) as string[],
      platformAdmin: false,
    };
  });

/** Lists the permission catalog + role defaults for the team UI. */
export const listPermissionCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: perms }, { data: defaults }] = await Promise.all([
      context.supabase.from("rbac_permissions").select("key, category, label, description").order("category"),
      context.supabase.from("rbac_role_defaults").select("role, permission"),
    ]);
    return { permissions: perms ?? [], defaults: defaults ?? [] };
  });

/** Lists explicit permission overrides for members of an org. Owners/admins only. */
export const listMemberPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgRole(context, data.orgId, ["owner", "admin", "enterprise_admin"]);
    const { data: rows, error } = await context.supabase
      .from("organization_member_permissions")
      .select("id, user_id, permission, effect, granted_at, granted_by")
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const grantInput = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  permission: z.enum(PERMISSION_KEYS),
  effect: z.enum(["grant", "revoke"]),
});

/** Grants or revokes a specific permission for a member. MFA-required. */
export const setMemberPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantInput.parse(d))
  .handler(async ({ context, data }) => {
    requireMfa(context.claims);
    await requireOrgRole(context, data.orgId, ["owner", "admin"]);
    await enforceAuthRateLimit({ bucket: "rbac.grant", userId: context.userId, limit: 30, windowSec: 300 });

    const { error } = await context.supabase
      .from("organization_member_permissions")
      .upsert(
        {
          org_id: data.orgId,
          user_id: data.userId,
          permission: data.permission,
          effect: data.effect,
          granted_by: context.userId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "org_id,user_id,permission" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes an explicit permission override (falls back to role default). */
export const clearMemberPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      userId: z.string().uuid(),
      permission: z.enum(PERMISSION_KEYS),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    requireMfa(context.claims);
    await requireOrgRole(context, data.orgId, ["owner", "admin"]);
    const { error } = await context.supabase
      .from("organization_member_permissions")
      .delete()
      .eq("org_id", data.orgId)
      .eq("user_id", data.userId)
      .eq("permission", data.permission);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
