
# AI Property Intelligence & Discovery Engine

A discovery pipeline that continuously finds Kenyan accommodation businesses from **public, non-copyrighted sources**, classifies + enriches them with AI, deduplicates against existing listings, and hands them to admins/owners for verification. Reuses the existing `marketplace_properties` table and onboarding wizard rather than duplicating them.

## Scope

**In scope (this milestone):**
1. Database — `discovered_properties`, `discovery_sources`, `discovery_runs`, `property_claims`, `property_merge_audit`, county grouping helpers.
2. Discovery pipeline — Firecrawl-driven crawler over an allow-list of tourism directories + county pages + owner-submitted URLs. Never scrapes Booking.com / Expedia / Airbnb / TripAdvisor.
3. AI classification + enrichment — Lovable AI (`openai/gpt-5.5`) returns strict Zod-validated JSON (type, county, town, amenities, tags, keywords, original SEO description, per-field confidence).
4. Duplicate detection — trigram on name + haversine on GPS + phone/email/domain normalization; produces merge candidates.
5. Quality scoring — deterministic formula over completeness, verification, media, contactability.
6. Claim flow — public "Claim this property" on discovered records → owner verifies email/phone → converts the draft to a real `marketplace_properties` row wired into the existing onboarding wizard.
7. Admin Intelligence Console — `/listings/admin/discovery` with queues (new, claims, dupes, low-quality), approve / reject / merge / archive / promote actions, county coverage + trend widgets.
8. Public discovery browsing — `/discover` and `/discover/$county` list draft + published accommodations with a "This is my business — claim it" CTA.
9. Search indexing — pg_trgm + GIN on `(name, town, county, tags)` for instant free-text; filter facets by county/type/tags.
10. Background automation — `pg_cron` hits `/api/public/hooks/discovery-tick` hourly (crawl slice) and `/api/public/hooks/discovery-rescore` nightly (quality + dedupe sweep), guarded by `PARTNER_SYNC_CRON_SECRET`-style secret.
11. Security — RLS on every new table, `requireSupabaseAuth` on every server fn, admin-role gate on admin fns, rate limiting via existing `rate-limit.ts`, audit rows on every state change.

**Out of scope (call out to user, not built):**
- Auto-scraping Booking.com / Expedia / Airbnb / TripAdvisor content — legally + policy-forbidden. We only ingest **factual** business info from owner-supplied URLs, county tourism sites, and Google Business via existing Maps Platform connector.
- Real ID/KYC provider for owner verification (uses email+phone OTP challenge instead).
- Auto-publishing without admin approval — every discovered draft requires an approve step.
- ML retraining loop — "AI learning" is implemented as a `discovery_feedback` table + prompt-time context injection, not a fine-tuning pipeline.

## Architecture

```text
                        ┌──────────────────────────┐
  pg_cron ── hourly ──► │ /api/public/hooks/       │
                        │   discovery-tick         │
                        └──────────┬───────────────┘
                                   ▼
  seed URLs ──►  discovery.crawler.server ──► Firecrawl (map + scrape)
                                   ▼
                        raw pages → discovery.extract.server
                                   ▼
                        Lovable AI (gpt-5.5, JSON schema)
                                   ▼
                        upsert public.discovered_properties
                                   ▼
                        discovery.dedupe.server (trgm + haversine)
                                   ▼
                        discovery.score.server (quality 0-100)
                                   ▼
        ┌────────────── admin console ──────────────┐
        │  approve → promote to marketplace_properties│
        │  merge   → merge_audit + soft-delete dupe   │
        │  reject  → archived + reason                │
        │  claim   → property_claims → onboarding     │
        └────────────────────────────────────────────┘
```

## Database (single migration)

```sql
-- discovery source registry (allow-list, no Booking.com/Expedia/Airbnb)
CREATE TABLE public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('directory','county_page','owner_url','google_business')),
  url text not null unique,
  county_code text,
  enabled boolean not null default true,
  last_crawled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- one row per candidate accommodation business
CREATE TABLE public.discovered_properties (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','merged','archived','claimed')),
  source_id uuid references public.discovery_sources(id) on delete set null,
  source_url text,
  name text not null,
  property_type text,
  county_code text,
  town text, ward text,
  address text,
  latitude double precision, longitude double precision,
  phone text, email text, whatsapp text, website text, socials jsonb default '{}'::jsonb,
  amenities text[] default '{}',
  tags text[] default '{}',
  keywords text[] default '{}',
  ai_description text,
  ai_confidence jsonb default '{}'::jsonb,   -- {name:0.9, gps:0.7, ...}
  quality_score int not null default 0,
  dedupe_fingerprint text,
  merged_into uuid references public.discovered_properties(id),
  promoted_property_id uuid references public.marketplace_properties(id),
  rejection_reason text,
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
CREATE INDEX ON public.discovered_properties USING gin (
  (name || ' ' || coalesce(town,'') || ' ' || coalesce(county_code,'')) gin_trgm_ops
);
CREATE INDEX ON public.discovered_properties (status, county_code, quality_score DESC);
CREATE INDEX ON public.discovered_properties (dedupe_fingerprint) WHERE dedupe_fingerprint IS NOT NULL;

CREATE TABLE public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(), finished_at timestamptz,
  ok boolean, stats jsonb default '{}'::jsonb, error text
);

CREATE TABLE public.property_claims (
  id uuid primary key default gen_random_uuid(),
  discovered_id uuid not null references public.discovered_properties(id) on delete cascade,
  claimant_id uuid references auth.users(id) on delete set null,
  claimant_email text not null,
  claimant_phone text,
  proof_notes text,
  status text not null default 'pending'
    check (status in ('pending','verified','rejected','withdrawn')),
  verification_code_hash text,
  verified_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

CREATE TABLE public.property_merge_audit (
  id uuid primary key default gen_random_uuid(),
  primary_id uuid references public.discovered_properties(id) on delete set null,
  duplicate_id uuid references public.discovered_properties(id) on delete set null,
  performed_by uuid references auth.users(id),
  reason text, diff jsonb, created_at timestamptz default now()
);

CREATE TABLE public.discovery_feedback (
  id uuid primary key default gen_random_uuid(),
  discovered_id uuid references public.discovered_properties(id) on delete cascade,
  field text not null, before_value jsonb, after_value jsonb,
  editor_id uuid references auth.users(id),
  edited_at timestamptz default now()
);
```

Every table: `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated;` + `GRANT ALL ... TO service_role;` + RLS on. Public gets `SELECT` only on `discovered_properties WHERE status in ('pending','approved','claimed')` and only safe columns via a `public_discovered_properties` view (contact fields excluded). Admin (`has_role(uid,'admin')`) can do everything.

## Files to add

Server functions & helpers:
- `src/lib/discovery.functions.ts` — `listDiscovered`, `getDiscovered`, `submitOwnerUrl`, `startClaim`, `verifyClaim`, `adminApprove`, `adminReject`, `adminMerge`, `adminPromote`.
- `src/lib/discovery-ai.functions.ts` — `aiClassifyAndEnrich` (Lovable AI, strict JSON schema).
- `src/lib/discovery.server.ts` — crawler orchestration, Firecrawl client wrapper, extract → normalize.
- `src/lib/discovery-dedupe.server.ts` — trigram + haversine + fingerprint helpers.
- `src/lib/discovery-score.server.ts` — deterministic quality scorer.

Routes:
- `src/routes/discover.index.tsx` — public county grid + free-text search.
- `src/routes/discover.$county.tsx` — county page with facets.
- `src/routes/discover.$county.$slug.tsx` — public detail + "Claim this property" CTA.
- `src/routes/_authenticated/discovery.claim.$id.tsx` — owner claim flow (email OTP → converts to onboarding).
- `src/routes/_authenticated/listings.admin.discovery.tsx` — admin console (queues, actions, trends).
- `src/routes/api/public/hooks/discovery-tick.ts` — crawl slice (cron-secured).
- `src/routes/api/public/hooks/discovery-rescore.ts` — nightly dedupe + rescore.

Components:
- `src/components/discovery/DiscoveryCard.tsx`, `ClaimDialog.tsx`, `MergeCandidateList.tsx`, `QualityBadge.tsx`, `CountyCoverageChart.tsx`.

Nav: add "Discovery" tab to admin section of `dashboard-shell.tsx`.

## Cron

Schedules created via `supabase--migration`:
- `*/17 * * * *` → `discovery-tick` (crawl one enabled `discovery_sources` row per tick, hard cap 30 pages / 5 min).
- `15 3 * * *` → `discovery-rescore` (rebuild fingerprints, dedupe candidates, refresh quality scores).
Both authenticated by `Authorization: Bearer $PARTNER_SYNC_CRON_SECRET` — reusing the existing cron secret pattern from `partner-sync.ts`.

## Security

- Every server fn: `.middleware([requireSupabaseAuth])`; admin fns additionally check `has_role(uid,'admin')` server-side.
- Public route loaders read via a server publishable-key client against `public_discovered_properties` view (contact fields excluded).
- Claim OTP: 6-digit code, bcrypt-hashed in `verification_code_hash`, 15-min expiry, 5-try lockout — reuses `rate-limit.ts`.
- Firecrawl calls: server-only, allow-list host check before every crawl; reject Booking/Expedia/Airbnb/TripAdvisor domains at the crawler entry.
- All admin state changes append to `property_merge_audit` / `discovery_feedback` / `audit_logs`.

## Verification

- Vitest units: fingerprint hashing, haversine, quality scorer, allow-list filter.
- Playwright (headless via shell): claim flow happy path + admin approve/merge/reject.
- Manual: seed 5 `discovery_sources` (KATO, Magical Kenya, county tourism pages), run one tick, inspect admin console.

## Deliverable

One migration + ~14 new files + `dashboard-shell.tsx` nav edit + 2 cron schedules. Existing tables/routes untouched.
