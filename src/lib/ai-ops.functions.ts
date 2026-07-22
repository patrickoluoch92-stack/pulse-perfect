// Admin-only server functions for the AI Ops dashboard.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const getAiOpsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();

    const [{ data: agents }, { data: recentRuns }, { data: queueRows }] = await Promise.all([
      supabaseAdmin.from("ai_agents").select("*").order("slug"),
      supabaseAdmin
        .from("ai_agent_runs")
        .select("agent_slug, status, latency_ms, tokens_input, tokens_output, cost_usd, created_at")
        .gte("created_at", since24)
        .limit(2000),
      supabaseAdmin
        .from("ai_agent_jobs")
        .select("agent_slug, status")
        .in("status", ["queued", "running", "dead"])
        .limit(2000),
    ]);

    const summaryBySlug: Record<string, any> = {};
    for (const a of agents ?? []) {
      summaryBySlug[a.slug] = {
        ...a,
        runs24h: 0,
        succeeded24h: 0,
        failed24h: 0,
        avgLatencyMs: 0,
        costUsd24h: 0,
        queued: 0,
        running: 0,
        dead: 0,
      };
    }
    const latencySum: Record<string, { n: number; ms: number }> = {};
    for (const r of recentRuns ?? []) {
      const s = summaryBySlug[r.agent_slug];
      if (!s) continue;
      s.runs24h += 1;
      if (r.status === "succeeded") s.succeeded24h += 1;
      if (r.status === "failed" || r.status === "timeout") s.failed24h += 1;
      s.costUsd24h += Number(r.cost_usd ?? 0);
      if (r.latency_ms != null) {
        const b = (latencySum[r.agent_slug] ??= { n: 0, ms: 0 });
        b.n += 1;
        b.ms += Number(r.latency_ms);
      }
    }
    for (const [slug, b] of Object.entries(latencySum)) {
      if (summaryBySlug[slug]) summaryBySlug[slug].avgLatencyMs = Math.round(b.ms / b.n);
    }
    for (const q of queueRows ?? []) {
      const s = summaryBySlug[q.agent_slug];
      if (!s) continue;
      if (q.status === "queued") s.queued += 1;
      else if (q.status === "running") s.running += 1;
      else if (q.status === "dead") s.dead += 1;
    }
    return { agents: Object.values(summaryBySlug) };
  });

export const listRecentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_agent_runs")
      .select("id, agent_slug, status, latency_ms, cost_usd, error, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    return { runs: rows ?? [] };
  });

export const listRecentDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_agent_decisions")
      .select("id, agent_slug, action, subject_type, subject_id, confidence, rationale, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    return { decisions: rows ?? [] };
  });

export const toggleAgentPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ slug: z.string().min(1), paused: z.boolean() }).parse(v),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({ paused: data.paused })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requeueAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ slug: z.string().min(1) }).parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { enqueue } = await import("@/lib/ai-orchestrator.server");
    await enqueue(
      data.slug as any,
      { manual: true },
      { priority: 1, dedupeKey: `manual-${Date.now()}` },
    );
    return { ok: true };
  });
