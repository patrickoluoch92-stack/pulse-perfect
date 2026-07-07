// Shared Knowledge Layer — versioned property facts + search analytics.
// Consumed by Discovery, Revenue, and Concierge engines.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Scope = z.enum(["quality", "bookings", "search", "composite"]);
const Engine = z.enum(["discovery", "revenue", "concierge", "manual", "system"]);

// ---------------- Upsert a fact (versioned) ----------------

const UpsertInput = z.object({
  propertyId: z.string().uuid(),
  orgId: z.string().uuid().nullable().optional(),
  scope: Scope,
  sourceEngine: Engine,
  payload: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1).default(1),
  computedAt: z.string().datetime().optional(),
});

/**
 * Upsert a fact for (propertyId, scope). On update the trigger:
 *  - copies the previous row into knowledge_fact_history
 *  - increments the version counter
 */
export const upsertPropertyFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      property_id: data.propertyId,
      org_id: data.orgId ?? null,
      scope: data.scope,
      source_engine: data.sourceEngine,
      payload: data.payload,
      confidence: data.confidence,
      computed_at: data.computedAt ?? new Date().toISOString(),
      created_by: userId,
    };
    const { data: out, error } = await supabase
      .from("knowledge_property_facts" as any)
      .upsert(row, { onConflict: "property_id,scope" })
      .select("id, version, scope, source_engine, confidence, computed_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

// ---------------- Read latest facts ----------------

const ReadInput = z.object({
  propertyId: z.string().uuid(),
  scopes: z.array(Scope).optional(),
});

export const getPropertyFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReadInput.parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("knowledge_property_facts" as any)
      .select("id, scope, source_engine, version, payload, confidence, computed_at, updated_at")
      .eq("property_id", data.propertyId);
    if (data.scopes?.length) q = q.in("scope", data.scopes);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------- Bulk read for many properties (engine helper) ----------------

const BulkInput = z.object({
  propertyIds: z.array(z.string().uuid()).min(1).max(500),
  scope: Scope,
});

export const getFactsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("knowledge_property_facts" as any)
      .select("property_id, version, payload, confidence, updated_at")
      .in("property_id", data.propertyIds)
      .eq("scope", data.scope);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------- Fact history ----------------

const HistoryInput = z.object({
  factId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const getFactHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HistoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("knowledge_fact_history" as any)
      .select("version, source_engine, payload, confidence, computed_at, archived_at")
      .eq("fact_id", data.factId)
      .order("version", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------- Search analytics ----------------

const LogSearchInput = z.object({
  orgId: z.string().uuid().nullable().optional(),
  engine: z.enum(["discovery", "concierge", "marketplace", "revenue"]),
  query: z.string().max(500),
  filters: z.record(z.string(), z.any()).default({}),
  resultCount: z.number().int().min(0),
  topPropertyIds: z.array(z.string().uuid()).max(20).default([]),
  latencyMs: z.number().int().min(0).optional(),
});

export const logSearchEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogSearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("knowledge_search_events" as any).insert({
      org_id: data.orgId ?? null,
      user_id: context.userId,
      engine: data.engine,
      query: data.query,
      filters: data.filters,
      result_count: data.resultCount,
      top_property_ids: data.topPropertyIds,
      latency_ms: data.latencyMs ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AnalyticsInput = z.object({
  orgId: z.string().uuid().nullable().optional(),
  engine: z.enum(["discovery", "concierge", "marketplace", "revenue"]).optional(),
  days: z.number().int().min(1).max(90).default(14),
});

export const getSearchAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyticsInput.parse(input))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = context.supabase
      .from("knowledge_search_events" as any)
      .select("engine, query, result_count, latency_ms, created_at")
      .gte("created_at", since);
    if (data.orgId) q = q.eq("org_id", data.orgId);
    if (data.engine) q = q.eq("engine", data.engine);
    const { data: rows, error } = await q.limit(2000);
    if (error) throw new Error(error.message);

    const events = rows ?? [];
    const total = events.length;
    const zeroResult = events.filter((e: any) => e.result_count === 0).length;
    const avgLatency =
      events.reduce((s: number, e: any) => s + (e.latency_ms ?? 0), 0) / Math.max(1, total);

    const queryCounts = new Map<string, { count: number; zero: number }>();
    for (const e of events as any[]) {
      const key = (e.query as string).trim().toLowerCase();
      const cur = queryCounts.get(key) ?? { count: 0, zero: 0 };
      cur.count++;
      if (e.result_count === 0) cur.zero++;
      queryCounts.set(key, cur);
    }
    const topQueries = [...queryCounts.entries()]
      .map(([query, v]) => ({ query, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      total,
      zeroResultRate: total ? zeroResult / total : 0,
      avgLatencyMs: Math.round(avgLatency),
      topQueries,
    };
  });
