# HostPulse Evolution — Phase 1 Audit

_Audit of the Super AI orchestrator + agent layer. Basis for the build plan below. Only Phase 1 scope; Phases 2–4 will be audited before their respective builds._

## 1. What already exists (do not rebuild)

### Orchestrator core — `src/lib/ai-orchestrator.server.ts`
Complete and production-shaped:
- `enqueue(agent, payload, {dedupeKey, priority, delayMs, maxAttempts})` with `23505` dedup handling.
- Atomic claim via `ai_claim_agent_jobs` RPC + non-atomic fallback.
- `runTick(batchSize)` with per-agent pause/enable check (`ai_agents.enabled/paused`), exponential backoff (`2^attempts * 30s`, cap 1h), max-attempts → dead letter.
- `recordRun` and `recordDecision` logging with tokens/cost/latency/model fields.
- Cron drain wired at `src/routes/api/public/hooks/orchestrator-tick.ts` (secret-gated).

### Agent adapters — `src/lib/agents/*.server.ts` (11 files)
| Slug | Status | Notes |
|---|---|---|
| `discovery` | Real | Calls `crawlNextSource()`. |
| `verification` | Real | Re-scores `discovered_properties` via `computeQualityScore`. |
| `market` | Real | `runMarketTick()`. |
| `fraud` | Real | Delegates to `runFraudTick`/`scoreRecentBookings`. |
| `vision` | Real | `runVisionTick(limit)`. |
| `learning` | Real | Rolls up `recommendation_events` → `user_preference_vectors`. |
| `enrichment` | **Misaligned** | Currently calls `runSeoGenTick` — that's SEO, not POI enrichment. Real POI enrichment already lives in `enrichment-tick.server.ts` but is not wired. |
| `categorization` | **Stub** | Returns `{ note: "handled inline in discovery" }`. No background re-classification of legacy rows. |
| `booking` | **Stub** | Heartbeat only. No booking-probability / cancellation-risk scoring. |
| `recommend` | **Stub** | Ranking runs on-request. No pre-compute/warm-cache job. |
| `concierge` | **Stub** | Heartbeat only. No background KB fact refresh. |

### Supporting subsystems (reused, not touched)
- Discovery: `discovery.server.ts`, `discovery-dedupe.server.ts`, `discovery-score.server.ts`, `property_claims`.
- Fraud: `fraud-ml.server.ts` (Z-score anomaly).
- Vision: `vision.functions.ts`, `image_ai_tags` (GIN indexed).
- Market: `market-intelligence.server.ts`, `market-stats.server.ts`, `pricing_signals`, `county_market_stats`.
- Concierge: `concierge.functions.ts` + `/concierge` route (rate-limited, auth-gated).
- Recommendations: `recommendations.functions.ts` + pgvector embeddings + `recommendation_events`.
- Semantic search: `semantic-search.functions.ts`.
- AI gateway: `ai.server.ts` (unified `aiChat`, `aiJSON`, `aiVisionJSON`, `aiEmbed`, `aiEmbedBatch`).
- Admin UI: `/admin/ai-ops` + `ai-ops.functions.ts`, `/admin/ai-command`.

## 2. Gaps to close in this pass (Phase 1)

### G1. Enrichment adapter is wrong
`enrichment.agent.server.ts` calls SEO gen, not POI enrichment. Fix: route it to `enrichment-tick.server.ts` (Places-driven POI enrichment). Move SEO gen into a dedicated cron path or a new `seo` agent slug.

### G2. Booking Intelligence AI has no real scoring
Spec requires: booking-probability, cancellation-risk, demand-spike detection, best-booking-time, dynamic-pricing hooks. Currently just counts bookings.

**Build:** extend `revenue-intelligence.functions.ts` with `scoreBookingProbability(propertyId, checkIn, checkOut)` and `scoreCancellationRisk(bookingId)` using recency, price-vs-market, lead-time, guest history, seasonality. Wire booking adapter to run a rolling score-recent-bookings pass and write results to a new `booking_intelligence` table (score, factors JSON, computed_at).

### G3. Categorization has no background re-classification
When `property_category_nodes` gains new nodes or an unmatched legacy row exists, nothing re-categorizes it.

**Build:** categorization adapter iterates rows with `category_slug IS NULL OR parent_category_slug IS NULL`, calls the existing AI extractor, upserts taxonomy, records a decision.

### G4. Concierge KB refresh never runs
`knowledge_property_facts` is populated by concierge on-request but never re-freshed for stale properties.

**Build:** concierge adapter picks the N oldest facts (or missing facts for approved marketplace properties), refreshes them, logs decision.

### G5. Recommendation warm-cache
Not strictly required (on-request is fine), but for cost predictability we should pre-compute top-K per active user weekly. Deferred unless you want it in this pass.

### G6. AI safety guard (spec: "prompt injection prevention", "rate limiting", "secure AI prompts")
No central `ai-guard.server.ts`. Rate limiting exists per-feature (concierge), PII redaction exists in webhook path, but there's no unified guard the orchestrator applies to every agent run.

**Build:** `src/lib/ai-guard.server.ts` with:
- `redactPII(text)` — strip emails/phones/national IDs before logging to `ai_agent_runs.metadata` / `ai_agent_decisions.inputs`.
- `checkPromptInjection(text)` — heuristic flags (system-prompt override attempts, delimiter escapes) → tags run as `suspicious`.
- `enforceHourlyBudget(agent, tokensSpent)` — reads `ai_agent_runs` sum for last 60m; if over threshold, auto-pauses the agent (`ai_agents.paused = true`) and records a decision.

Integrate as helpers called from adapters — not from orchestrator core — so failures are per-agent, not per-tick.

### G7. Explainable decisions (spec: "recommendations are explainable")
`recordDecision` exists but the recommendation and concierge paths don't call it. Add `recordDecision` calls at recommendation-serving sites so `/admin/ai-ops` can answer "why was I shown this?".

### G8. Agent registry seeding
`ai_agents` table exists but may not be seeded with all 11 slugs. Add idempotent seed migration.

## 3. Explicitly out of scope for Phase 1

- Planner AI extensions (Phase 2).
- Booking/payment/maps hand-off (Phase 3).
- Investor dashboard, PDF/Excel exports, enterprise portal (Phase 4).
- New scraping sources (content work, not engineering).
- Rebuilding concierge, discovery, vision, fraud, market — they work.
- Background workers on new infra — stays on `pg_cron` + `/api/public/hooks/*`.

## 4. Delivery order (checkpoints)

Each is an independently reviewable change:

1. **Fix G1 + G8** — enrichment adapter routes to POI enrichment; seed `ai_agents` for all 11 slugs.
2. **G3 + G4** — categorization background pass; concierge KB refresh.
3. **G2** — booking intelligence table + scoring functions + adapter.
4. **G6** — `ai-guard.server.ts` (redactPII, injection heuristic, hourly budget breaker) and integrate into 4–5 highest-cost adapters.
5. **G7** — `recordDecision` calls at recommendation + concierge serving sites; `/admin/ai-ops` gains a decisions drill-down link if not already present.

## 5. Risks & notes

- **Cost:** `ai-guard` hourly budget breaker needs a per-agent USD threshold. Suggest default `$1/hr` per agent; overridable via `ai_agents.metadata.hourly_budget_usd`.
- **RLS:** new `booking_intelligence` table needs admin+owner-only SELECT, service-role writes only. Standard grant block.
- **Backward compat:** all adapter changes preserve existing signatures. Cron endpoints unchanged.
- **PII:** `ai-guard.redactPII` runs before ANY log write; verify no existing adapter logs raw payloads that would break if redacted.

---

Approve and I'll ship checkpoint 1 (G1 + G8) as the first change.
