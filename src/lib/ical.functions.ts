import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseICS } from "@/lib/ical";

const orgIdSchema = z.object({ orgId: z.string().uuid() });

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
