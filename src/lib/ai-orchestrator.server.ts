// AI Orchestrator: durable queue + run/decision logging for HostPulse agents.
// Server-only. Called by /api/public/hooks/orchestrator-tick and by other
// server modules that want to enqueue work.

type Sb = any;

async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

export type AgentSlug =
  | "discovery"
  | "verification"
  | "categorization"
  | "market"
  | "recommend"
  | "booking"
  | "fraud"
  | "enrichment"
  | "vision"
  | "concierge"
  | "learning";

export interface EnqueueOpts {
  dedupeKey?: string;
  priority?: number; // 1 (highest) - 10 (lowest); default 5
  delayMs?: number;
  maxAttempts?: number;
}

export async function enqueue(
  agent: AgentSlug,
  payload: Record<string, unknown> = {},
  opts: EnqueueOpts = {},
): Promise<{ id: string | null; deduped: boolean }> {
  const sb = await admin();
  const runAt = new Date(Date.now() + (opts.delayMs ?? 0)).toISOString();
  const row = {
    agent_slug: agent,
    payload,
    priority: opts.priority ?? 5,
    dedupe_key: opts.dedupeKey ?? null,
    next_run_at: runAt,
    max_attempts: opts.maxAttempts ?? 5,
  };
  const { data, error } = await sb.from("ai_agent_jobs").insert(row).select("id").maybeSingle();
  if (error) {
    // Unique-dedupe conflict -> already queued/running; treat as dedup.
    if (String(error.code) === "23505") return { id: null, deduped: true };
    throw new Error(`orchestrator.enqueue: ${error.message}`);
  }
  return { id: data?.id ?? null, deduped: false };
}

export interface RecordRunInput {
  agentSlug: AgentSlug;
  jobId?: string | null;
  status: "succeeded" | "failed" | "skipped" | "timeout";
  latencyMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
  costUsd?: number;
  model?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export async function recordRun(input: RecordRunInput): Promise<string | null> {
  const sb = await admin();
  const { data, error } = await sb
    .from("ai_agent_runs")
    .insert({
      agent_slug: input.agentSlug,
      job_id: input.jobId ?? null,
      status: input.status,
      latency_ms: input.latencyMs ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      cost_usd: input.costUsd ?? null,
      model: input.model ?? null,
      error: input.error ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("orchestrator.recordRun failed", error);
    return null;
  }
  return data?.id ?? null;
}

export interface RecordDecisionInput {
  agentSlug: AgentSlug;
  runId?: string | null;
  subjectType?: string;
  subjectId?: string;
  userId?: string | null;
  action: string;
  confidence?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  rationale?: string;
}

export async function recordDecision(input: RecordDecisionInput): Promise<void> {
  const sb = await admin();
  const { error } = await sb.from("ai_agent_decisions").insert({
    agent_slug: input.agentSlug,
    run_id: input.runId ?? null,
    subject_type: input.subjectType ?? null,
    subject_id: input.subjectId ?? null,
    user_id: input.userId ?? null,
    action: input.action,
    confidence: input.confidence ?? null,
    inputs: input.inputs ?? {},
    outputs: input.outputs ?? {},
    rationale: input.rationale ?? null,
  });
  if (error) console.error("orchestrator.recordDecision failed", error);
}

interface JobRow {
  id: string;
  agent_slug: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/**
 * Claim up to `batchSize` queued jobs using a SKIP LOCKED pattern via RPC.
 * We fall back to a best-effort UPDATE...RETURNING when the RPC is unavailable.
 */
async function claimJobs(batchSize: number): Promise<JobRow[]> {
  const sb = await admin();
  // Best-effort atomic claim: mark queued rows as running, ordered by priority.
  const { data, error } = await sb.rpc("ai_claim_agent_jobs", { batch: batchSize });
  if (!error && Array.isArray(data)) return data as JobRow[];

  // Fallback: non-atomic (works but may race under high concurrency).
  const { data: candidates } = await sb
    .from("ai_agent_jobs")
    .select("id, agent_slug, payload, attempts, max_attempts")
    .eq("status", "queued")
    .lte("next_run_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);
  const claimed: JobRow[] = [];
  for (const c of candidates ?? []) {
    const { data: upd, error: uerr } = await sb
      .from("ai_agent_jobs")
      .update({
        status: "running",
        claimed_at: new Date().toISOString(),
        attempts: (c.attempts ?? 0) + 1,
      })
      .eq("id", c.id)
      .eq("status", "queued")
      .select("id, agent_slug, payload, attempts, max_attempts")
      .maybeSingle();
    if (!uerr && upd) claimed.push(upd as JobRow);
  }
  return claimed;
}

async function markJob(
  id: string,
  status: "succeeded" | "failed" | "queued" | "dead",
  err?: string,
  backoffMs?: number,
) {
  const sb = await admin();
  const patch: Record<string, unknown> = {
    status,
    last_error: err ?? null,
    finished_at: status === "succeeded" || status === "dead" ? new Date().toISOString() : null,
  };
  if (status === "queued" && backoffMs) {
    patch.next_run_at = new Date(Date.now() + backoffMs).toISOString();
    patch.claimed_at = null;
  }
  await sb.from("ai_agent_jobs").update(patch).eq("id", id);
}

/**
 * Registry of agent runners. Each returns metadata that goes to `ai_agent_runs`.
 * Adapters are loaded lazily so that a broken agent doesn't take down the tick.
 */
const AGENT_LOADERS: Record<string, () => Promise<{ run: (payload: any) => Promise<any> }>> = {
  discovery: () => import("@/lib/agents/discovery.agent.server"),
  verification: () => import("@/lib/agents/verification.agent.server"),
  categorization: () => import("@/lib/agents/categorization.agent.server"),
  market: () => import("@/lib/agents/market.agent.server"),
  recommend: () => import("@/lib/agents/recommend.agent.server"),
  booking: () => import("@/lib/agents/booking.agent.server"),
  fraud: () => import("@/lib/agents/fraud.agent.server"),
  enrichment: () => import("@/lib/agents/enrichment.agent.server"),
  vision: () => import("@/lib/agents/vision.agent.server"),
  concierge: () => import("@/lib/agents/concierge.agent.server"),
  learning: () => import("@/lib/agents/learning.agent.server"),
};

async function agentEnabled(slug: string): Promise<boolean> {
  const sb = await admin();
  const { data } = await sb
    .from("ai_agents")
    .select("enabled, paused")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return true;
  return Boolean(data.enabled) && !data.paused;
}

/**
 * Drain up to `batchSize` jobs from the queue, execute their agent, log runs,
 * and reschedule with exponential backoff on failure.
 */
export async function runTick(
  batchSize = 8,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const jobs = await claimJobs(batchSize);
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    if (!(await agentEnabled(job.agent_slug))) {
      await markJob(job.id, "queued", "agent paused", 5 * 60_000);
      continue;
    }
    const loader = AGENT_LOADERS[job.agent_slug];
    if (!loader) {
      await markJob(job.id, "dead", `unknown agent: ${job.agent_slug}`);
      await recordRun({
        agentSlug: job.agent_slug as AgentSlug,
        jobId: job.id,
        status: "failed",
        error: "unknown agent",
      });
      failed++;
      continue;
    }
    const started = Date.now();
    try {
      const mod = await loader();
      const result = await mod.run(job.payload);
      await markJob(job.id, "succeeded");
      await recordRun({
        agentSlug: job.agent_slug as AgentSlug,
        jobId: job.id,
        status: "succeeded",
        latencyMs: Date.now() - started,
        metadata: result && typeof result === "object" ? (result as Record<string, unknown>) : {},
      });
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.attempts;
      const max = job.max_attempts;
      const dead = attempts >= max;
      const backoff = Math.min(60 * 60_000, 2 ** attempts * 30_000);
      await markJob(job.id, dead ? "dead" : "queued", message, dead ? undefined : backoff);
      await recordRun({
        agentSlug: job.agent_slug as AgentSlug,
        jobId: job.id,
        status: "failed",
        latencyMs: Date.now() - started,
        error: message,
      });
      failed++;
    }
  }
  return { processed: jobs.length, succeeded, failed };
}
