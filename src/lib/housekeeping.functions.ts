// Housekeeping tasks + maintenance tickets server functions.
// Scoped by the caller's current organization via RLS (is_org_member).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";

async function currentOrgId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .single();
  if (error || !data?.current_org_id) throw new Error("No active workspace");
  return data.current_org_id as string;
}

// ---------------- Housekeeping ----------------

export const listHousekeeping = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["pending", "in_progress", "done", "skipped", "all"]).default("pending"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const orgId = await currentOrgId(context.supabase, context.userId);
    let q = context.supabase
      .from("housekeeping_tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("scheduled_for", { ascending: true })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const createHousekeeping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        title: z.string().min(2).max(200),
        notes: z.string().max(2000).optional(),
        scheduledFor: z.string(), // ISO date
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        propertyId: z.string().uuid().optional(),
        unitId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "hk.create",
      userId: context.userId,
      limit: 120,
      windowSec: 3600,
    });
    const orgId = await currentOrgId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("housekeeping_tasks")
      .insert({
        org_id: orgId,
        title: data.title,
        notes: data.notes ?? null,
        scheduled_for: data.scheduledFor,
        priority: data.priority,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        assignee_id: data.assigneeId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateHousekeepingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "in_progress", "done", "skipped"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      status: data.status,
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    };
    const { error } = await context.supabase
      .from("housekeeping_tasks")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Maintenance ----------------

export const listMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["open", "in_progress", "resolved", "closed", "all"]).default("open"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const orgId = await currentOrgId(context.supabase, context.userId);
    let q = context.supabase
      .from("maintenance_tickets")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const createMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        title: z.string().min(2).max(200),
        description: z.string().max(5000).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        propertyId: z.string().uuid().optional(),
        unitId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit({
      bucket: "mt.create",
      userId: context.userId,
      limit: 60,
      windowSec: 3600,
    });
    const orgId = await currentOrgId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("maintenance_tickets")
      .insert({
        org_id: orgId,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        assignee_id: data.assigneeId ?? null,
        reported_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateMaintenanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      status: data.status,
      resolved_at:
        data.status === "resolved" || data.status === "closed" ? new Date().toISOString() : null,
    };
    const { error } = await context.supabase
      .from("maintenance_tickets")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
