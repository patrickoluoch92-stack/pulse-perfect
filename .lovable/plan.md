# HostPulse Super AI — Multi-Agent Orchestration Layer

This is a large, multi-week initiative. Rather than rewriting existing subsystems, I'll wrap them in a formal **agent orchestrator** and fill the remaining gaps. Almost every "agent" you listed maps to code that already exists in the project; the missing piece is a unified coordination layer, an agent registry, and an operator dashboard.

## What already exists (will be reused, not rebuilt)

| Requested agent | Existing implementation |
|---|---|
| Property Discovery AI | `src/lib/discovery.server.ts`, `discovery_sources`, `discovered_properties`, `discovery-tick` cron |
| Property Verification AI | `discovery-dedupe.server.ts`, `discovery-score.server.ts`, `property_claims` |
| Categorization AI | `taxonomy.functions.ts`, `property_category_nodes` hierarchy, discovery extractor |
| Market Intelligence AI | `market-intelligence.server.ts`, `market-stats.server.ts`, `pricing_signals`, `county_market_stats` |
| Recommendation AI | `recommendations.functions.ts`, `recommendation_events`, pgvector embeddings |
| Booking Intelligence AI | `revenue-intelligence.functions.ts` (forecasts, dynamic pricing) |
| Fraud Detection AI | `fraud-ml.server.ts`, `fraud-ml.functions.ts` (Z-score anomaly) |
| Enrichment AI | `enrichment-tick.server.ts`, `places.functions.ts` (Google Places) |
| Image Intelligence AI | `vision.functions.ts`, `image_ai_tags`, `image-dedupe.server.ts` |
| Conversational AI | `concierge.functions.ts`, `/concierge` route |
| Semantic search | `semantic-search.functions.ts` + pgvector on properties |
| AI Command Centre | `/admin/ai-command`, `executive.functions.ts` |

## What's actually missing (this plan builds)

### 1. Agent Orchestrator (new)
- **DB migration**: `ai_agents` (registry), `ai_agent_runs` (execution log w/ status, cost, latency, tokens), `ai_agent_jobs` (queue with dedupe key, priority, retry count, next_run_at), `ai_agent_decisions` (auditable "why this recommendation"), `ai_agent_metrics` (rolling KPIs). RLS: admin-only reads; service_role writes.
- **`src/lib/ai-orchestrator.server.ts`**: `enqueue(agent, payload, {dedupeKey, priority})`, `claimNext()`, `recordDecision()`, `recordRun()`, exponential-backoff retry, per-agent concurrency caps, cost budget guard.
- **Agent adapters** in `src/lib/agents/*.server.ts` — thin wrappers around existing functions so the orchestrator can call them uniformly (`discovery`, `verify`, `categorize`, `market`, `recommend`, `booking-intel`, `fraud`, `enrichment`, `vision`, `concierge`).

### 2. Unified tick endpoint (new)
- `src/routes/api/public/hooks/orchestrator-tick.ts` — cron-secret-gated, drains N jobs per tick across agents with fairness. Replaces need for one cron per agent going forward; existing per-agent crons keep working.

### 3. Learning loop (new)
- `learning-tick` job that reads `recommendation_events`, `knowledge_search_events`, `marketplace_bookings`, `marketplace_property_reviews` and updates per-user preference vectors + per-region demand weights. Writes back to `pricing_signals` and a new `user_preference_vectors` table.

### 4. Admin AI Ops Dashboard (new route)
- `src/routes/_authenticated/admin.ai-ops.tsx` — admin-gated. Live agent health, queue depth by agent, success/failure rates (24h/7d), avg latency, tokens spent, top failing jobs, recent decisions with drill-down, manual "re-run" button, pause/resume per agent.
- `src/lib/ai-ops.functions.ts` — server functions backing the dashboard, all `has_role('admin')`-gated.

### 5. Safety & abuse controls (new)
- Central `src/lib/ai-guard.server.ts`: prompt-injection heuristics, per-user rate limits (reusing `rate_limit_events`), max-tokens caps, PII redaction on log writes, cost circuit breaker (auto-pause an agent when hourly spend exceeds threshold).
- Applied inside the orchestrator so every agent inherits it.

### 6. Gap fixes surfaced by audit
- Add `booking_probability` + `cancellation_risk` scoring function (booking-intelligence agent) — currently missing; extends `revenue-intelligence`.
- Add image-tag search index (GIN on `image_ai_tags.tags`) so vision output is actually queryable.
- Add `ai_agent_decisions` linkage on recommendation responses so "why was I shown this?" is answerable.

## Explicitly out of scope for this pass
- New scraping sources (existing discovery pipeline handles this; adding sources is content work, not engineering).
- Rebuilding concierge, fraud, vision, or discovery — they exist and work.
- New payment/auth/notifications surface area.
- Native background workers — we stay on `pg_cron` + `/api/public/hooks/*`; Cloudflare Workers can't host long-lived workers.

## Technical notes
- All new tables get GRANTs + RLS in the same migration per project rules.
- Agent runner uses `SELECT ... FOR UPDATE SKIP LOCKED` for safe concurrent claiming.
- All AI calls route through existing `src/lib/ai.server.ts` (already unified on `openai/gpt-5.5` + Gemini embeddings).
- No changes to `auth`, `storage`, or auto-generated Supabase files.

## Delivery order (each is a checkpoint you can stop at)
1. Migration + orchestrator core + agent adapters + admin dashboard.
2. Learning loop + `orchestrator-tick` cron wiring.
3. Booking-probability/cancellation-risk agent + image-tag index.
4. AI guard (rate limit, PII redaction, cost circuit breaker).
5. Audit report at `docs/AI_SUPER_AUDIT.md` + prioritized roadmap for anything still open.

Approve and I'll start with step 1; each subsequent step lands as its own change so you can review incrementally.
