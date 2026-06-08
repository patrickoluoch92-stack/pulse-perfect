import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseICS } from "@/lib/ical";

const orgIdSchema = z.object({ orgId: z.string().uuid() });

const DEFAULT_TOKEN_TTL_DAYS = 365;

export const listExportableUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("units")
      .select("id, name, property_id, ical_export_token, ical_export_token_created_at, ical_export_token_expires_at, properties(name)")
      .eq("org_id", data.orgId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const MIN_ROTATION_INTERVAL_MS = 10_000;

async function assertCanManageUnit(
  supabase: typeof import("@supabase/supabase-js").SupabaseClient.prototype,
  unitId: string,
  userId: string,
) {
  const { data: unit, error } = await supabase
    .from("units")
    .select("id, org_id, ical_export_token_created_at")
    .eq("id", unitId)
    .single();
  if (error || !unit) throw new Error("Unit not found");
  const { data: ok, error: roleErr } = await supabase.rpc("has_org_role", {
    _user_id: userId,
    _org_id: unit.org_id,
    _roles: ["owner", "admin", "manager"],
  });
  if (roleErr) throw new Error(roleErr.message);
  if (!ok) throw new Error("You don't have permission to manage this unit's iCal token");
  return unit;
}

export const rotateIcalExportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unitId: z.string().uuid(),
      ttlDays: z.number().int().min(1).max(3650).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const unit = await assertCanManageUnit(context.supabase, data.unitId, context.userId);

    if (unit.ical_export_token_created_at) {
      const age = Date.now() - new Date(unit.ical_export_token_created_at).getTime();
      if (age < MIN_ROTATION_INTERVAL_MS) {
        throw new Error("Token was just rotated — please wait a moment before rotating again");
      }
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const now = new Date();
    const expires = new Date(now.getTime() + (data.ttlDays ?? DEFAULT_TOKEN_TTL_DAYS) * 86400000);

    const { data: row, error } = await context.supabase
      .from("units")
      .update({
        ical_export_token: token,
        ical_export_token_created_at: now.toISOString(),
        ical_export_token_expires_at: expires.toISOString(),
      })
      .eq("id", data.unitId)
      .select("id, ical_export_token, ical_export_token_expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Audit the rotation
    await context.supabase.from("ical_access_log").insert({
      org_id: unit.org_id,
      unit_id: unit.id,
      token_prefix: token.slice(0, 8),
      status: "rotated",
      ip: null,
      user_agent: `user:${context.userId}`,
    });

    return row;
  });

export const setIcalTokenExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unitId: z.string().uuid(),
      ttlDays: z.number().int().min(1).max(3650).nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertCanManageUnit(context.supabase, data.unitId, context.userId);
    const expires = data.ttlDays === null
      ? null
      : new Date(Date.now() + data.ttlDays * 86400000).toISOString();
    const { data: row, error } = await context.supabase
      .from("units")
      .update({ ical_export_token_expires_at: expires })
      .eq("id", data.unitId)
      .select("id, ical_export_token_expires_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeIcalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Expire immediately — the URL stops working, but the column stays non-null.
    const { error } = await context.supabase
      .from("units")
      .update({ ical_export_token_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", data.unitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listIcalAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ical_access_log")
      .select("id, unit_id, status, ip, user_agent, token_prefix, created_at, units(name)")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


export const listIcalSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ical_import_sources")
      .select("id, name, url, unit_id, last_synced_at, last_status, last_error, event_count, units(name, property_id, properties(name))")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const addSchema = z.object({
  orgId: z.string().uuid(),
  unitId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Must be http(s)"),
});

export const addIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ical_import_sources")
      .insert({ org_id: data.orgId, unit_id: data.unitId, name: data.name, url: data.url })
      .select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ical_import_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const syncIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: src, error: srcErr } = await supabase
      .from("ical_import_sources")
      .select("id, org_id, unit_id, url")
      .eq("id", data.id).single();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Source not found");

    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "HostPulse iCal Sync/1.0", Accept: "text/calendar, */*" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
      const text = await res.text();
      const events = parseICS(text);

      // Replace strategy: delete existing blocks for this source, re-insert.
      const del = await supabase.from("calendar_blocks").delete().eq("source_id", src.id);
      if (del.error) throw new Error(del.error.message);

      if (events.length > 0) {
        const rows = events.map((e) => ({
          org_id: src.org_id,
          unit_id: src.unit_id,
          source_id: src.id,
          uid: e.uid,
          summary: e.summary,
          starts_on: e.startsOn,
          ends_on: e.endsOn,
        }));
        const ins = await supabase.from("calendar_blocks").insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }

      await supabase.from("ical_import_sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        event_count: events.length,
      }).eq("id", src.id);

      return { ok: true, count: events.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from("ical_import_sources").update({
        last_synced_at: new Date().toISOString(),
        last_status: "error",
        last_error: message.slice(0, 500),
      }).eq("id", src.id);
      throw new Error(message);
    }
  });

export const listUnitBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("calendar_blocks")
      .select("id, summary, starts_on, ends_on, source_id, ical_import_sources(name)")
      .eq("unit_id", data.unitId)
      .order("starts_on", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
