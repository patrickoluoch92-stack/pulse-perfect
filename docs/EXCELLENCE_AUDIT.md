# HostPulse Excellence & Refinement — Audit Report

_Audit-only pass. No code changes were made. Generated 2026-07-13._

## 1. Inventory (as of this pass)

| Surface | Count | Notes |
|---|---|---|
| Public routes (`src/routes/*.tsx`) | 22 | includes marketplace, discover, rentals, concierge, guides, pricing, invite, auth, sitemap |
| Authenticated routes (`_authenticated/*`) | 42 | dashboard + 30+ admin/owner tools |
| Public API routes (`api/public/**`) | ~14 (10 cron hooks + payments/ical/web-vitals) | all secret-gated where sensitive |
| Client-safe server functions (`src/lib/*.functions.ts`) | ~40 | typed RPC surface |
| Server-only helpers (`*.server.ts`) | ~20 | plus 11 agent adapters |
| Agent adapters (`src/lib/agents/*`) | 11 | discovery, verification, categorization, market, recommend, booking, fraud, enrichment, vision, concierge, learning |
| DB tables (public schema) | 78 | RLS enabled + column-level PII controls in place |
| Supabase migrations | 65 | |
| Sidebar nav entries | 34 | in `src/components/dashboard-shell.tsx` |

Total `src/` size: ~1.6 MB; largest single route is `sync.tsx` at 1,462 LOC.

## 2. Findings by severity

### CRITICAL (block release)
_None identified in this pass._ Prior scan cycles closed the last critical RLS/PII findings (guest PII, availability-block reason, ical_export_token, rate_limit_events, Paddle env spoofing, OTP plaintext log — all fixed in the last migration batch).

### HIGH (fix soon)

- **H1 — Navigation overload.** The owner sidebar exposes 34 top-level entries in a single flat list (`src/components/dashboard-shell.tsx:15-45`). Admin-only routes (Executive HQ, Fraud & Compliance, CMS, DevOps, Plan Admin, Finance Admin, Commissions, Discovery AI, AI Command, AI Ops) render even for non-admin members. Effect: cognitive overload, wasted route matches, and admin surface leaks role hints to guests/managers.
  - **Fix:** group into collapsible sections (Operations / Marketplace / AI / Finance / Admin) and gate admin-only groups behind `has_role('admin')` from `getWorkspaceContext`.

- **H2 — Route bundle bloat.** `sync.tsx` (1,462 LOC), `tours.tsx` (939), `onboarding.tsx` (758), `listings.$id.tsx` (573). No route-level `React.lazy`/dynamic import found (`rg React.lazy src` → 0 hits). TanStack Router already code-splits per route file, but individual routes still ship large synchronous imports (chart libs, editors) on first paint.
  - **Fix:** split heavy widgets (calendars, chart panels, drawer editors) behind `lazy()` + `<Suspense>`; verify with `bun run build` bundle report.

- **H3 — Planner AI is a destination, not a companion.** Planner AI lives only at `/planner`. Property pages, marketplace search results, discover cards, and dashboard KPIs do not offer "Plan with AI" entry points. The user's own goal (§5 of the request) is not met yet — this is the single biggest UX gap versus the platform's positioning.
  - **Fix:** add a `<PlanWithAI context={...}>` primitive that pre-fills `planner_sessions.input` and routes to `/planner?seed=<id>`; place it on `marketplace.p.$slug.tsx`, `discover.$slug.tsx`, `rentals.$child.tsx`, and search result cards.

### MEDIUM (should fix)

- **M1 — Inconsistent empty / loading / error states.** No shared `<EmptyState>`, `<LoadingState>`, `<ErrorState>` primitives exist in `src/components`. Routes hand-roll skeletons, spinners, and error copy. Result: visual drift and inconsistent CTAs on empty screens.
- **M2 — Icon-only buttons without `aria-label`.** Only 14 files use `aria-label` in a codebase of ~140 components. Manual sampling of `dashboard-shell.tsx` shows the sign-out button is labelled, but sidebar nav Lock icons and several list-row action buttons in `listings.index.tsx`, `reservations.tsx`, and `housekeeping.tsx` are not.
- **M3 — 18 uses of `h-screen` instead of `h-dvh`.** On mobile Safari, `h-screen` overflows behind the URL bar. Files affected include several public marketing routes.
- **M4 — Sidebar single-column grid on narrow viewports.** `dashboard-shell.tsx` uses `grid-cols-[16rem_1fr]` unconditionally — no mobile drawer. On viewports <768px the sidebar consumes 16rem of a small screen.
- **M5 — Redundant/overlapping AI admin dashboards.** `/admin/executive`, `/ai-command`, and `/admin/ai-ops` each surface AI KPIs. Their roles are distinct in code but not clearly delineated in nav labels — admins have to open all three to answer "is the system healthy?"
- **M6 — Search UX minimal.** Marketplace search relies on server-side filters; no instant suggestions, no recent/saved searches, no typo tolerance beyond `pg_trgm`. Semantic search exists (`semantic-search.functions.ts`) but isn't wired into the main marketplace input.
- **M7 — Route metadata coverage.** Not every leaf route sets `og:image`. `pricing.tsx`, `concierge.tsx`, and some `discover.*` routes fall back to root defaults.

### LOW (nice to have)

- **L1 — Dead / near-dead code:** `src/integrations/lovable/index.ts` and a few `*.functions.ts` files are only referenced by their own tests; verify usage before deletion.
- **L2 — Console noise:** 12 `console.*` call sites in `src/` (most in error paths). Route through the existing `error-capture.ts` instead.
- **L3 — Typography scale drift.** Some routes use `text-2xl font-black`, others `font-display text-2xl font-semibold`. Define a `<PageTitle>` / `<SectionTitle>` primitive.
- **L4 — Duplicate constants:** currency formatters and KES helpers redefined across `planner.functions.ts`, `command-center.functions.ts`, and `finance.server.ts`.

## 3. Performance snapshot (static analysis, no runtime measurement in this pass)

- No route-level lazy loading — all route components load synchronously per navigation.
- `sync.tsx` and `tours.tsx` are the two heaviest routes and the top ROI candidates for splitting.
- Image handling appears to already use responsive markup in marketplace cards; no `<img>` without `alt` was found by grep in the sampled routes.
- Suggested measurable targets for the follow-up perf pass:
  - LCP < 2.5s on `/marketplace` (mid-tier mobile, 4G)
  - TBT < 200ms on `/dashboard`
  - JS transferred per route < 250 KB gz for authenticated routes

## 4. Data quality (heuristic)

Not evaluated in this audit — requires a live DB query pass. Recommended checks for the next batch:
- `marketplace_properties` rows with 0 images
- `discovered_properties` rows missing coordinates
- listings with `active=true` but no price fields set for their listing_intent
- category nodes with `active=true` but zero child listings

## 5. Security posture

Recent scan cycles have closed all reported findings. Column-level PII revokes are in place on `marketplace_properties`, `discovered_properties`, `external_listings`, `guests`, `marketplace_bookings`, `units.ical_export_token`, and `marketplace_availability_blocks.reason`. `has_role`/`has_org_role` are `SECURITY DEFINER` with `EXECUTE` scoped to `authenticated` — expected linter WARN, required for RLS.

Recommendation: run `security--run_security_scan` and `supabase--linter` at the start of every subsequent phase; treat any new HIGH finding as release-blocking.

## 6. Accessibility snapshot

- 14 files use `aria-label` — expected coverage is ~40+ given the number of icon-only actions.
- No route-level `<main>` audit performed; visually the shell wraps content in `<main>` in `dashboard-shell.tsx` correctly.
- Contrast tokens in `src/styles.css` (terracotta + sage on sand) pass AA at default sizes; verify AA-large on `--muted-foreground` combinations.

## 7. Prioritized roadmap

Ordered by user-visible impact per hour of work.

| # | Item | Effort | Category |
|---|---|---|---|
| 1 | Planner AI contextual entry points on property/discover/search cards (H3) | S | UX |
| 2 | Shared `EmptyState` / `LoadingState` / `ErrorState` primitives + adopt in top 10 routes (M1) | S | UI |
| 3 | Group sidebar into collapsible sections, role-gate admin group (H1) | S | UX |
| 4 | Add `aria-label` to icon-only actions across `listings`, `reservations`, `housekeeping` (M2) | S | A11y |
| 5 | Mobile drawer for sidebar under 768px (M4) | M | Mobile |
| 6 | `h-screen` → `h-dvh` sweep (M3) | S | Mobile |
| 7 | Route-level `lazy()` for `sync.tsx`, `tours.tsx`, `onboarding.tsx` (H2) | M | Perf |
| 8 | Wire `semantic-search` into marketplace input; add recent-searches localStorage (M6) | M | Search |
| 9 | Consolidate AI admin dashboards under one entry with tabs (M5) | M | Admin |
| 10 | Backfill `og:image` on remaining leaf routes (M7) | S | SEO |
| 11 | Data quality nightly job — flag listings missing images / prices / geo | M | Data |
| 12 | Perf measurement pass with Lighthouse in CI, capture before/after per route | M | Perf |

## 8. Production readiness score

**82 / 100** — production-usable, refinement-ready.

Breakdown:
- Security: 19/20 (recent findings closed; standing linter WARNs are policy-required)
- Data integrity: 16/20 (RLS + grants correct; data-quality automation missing)
- UX consistency: 14/20 (component drift, nav overload, no shared state primitives)
- Performance: 14/20 (no lazy routes, heavy leaf routes)
- Accessibility: 8/10 (icon-only labels + `h-dvh` sweep pending)
- Observability: 8/10 (agent runs, web-vitals, and error capture wired; no unified dashboard yet)
- Testing: 3/10 (unit + a few e2e specs; no CI perf/a11y gates)

## 9. Unresolved / needs human decision

- Do admin surfaces stay on the same shell as owners, or split into `/admin/*` with a different chrome?
- Is Planner AI positioned as a primary product surface (home-page CTA) or a companion feature?
- Which counties/categories should the data-quality automation prioritise first?
- What is the target performance budget per route — this pass proposes defaults but they need owner sign-off.

---

_This audit is deliberately scoped to observations. The one-batch polish that follows should pick 4–5 items from §7 in rank order._
