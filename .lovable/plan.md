# AI Property Onboarding & Ingestion Engine

A 10-step wizard that lets any hospitality operator (hotel, lodge, camp, villa, apartment, tour company, etc.) join HostPulse in under 5 minutes, with AI assistance, autosave, admin review, and instant search indexing.

Most of the underlying infrastructure already exists in HostPulse (marketplace_properties, rooms via `units`, marketplace_bookings, availability blocks, Google Places, Lovable AI, M-Pesa + Paddle, admin approval flow, storage bucket, sitemap). This plan wires those into a single premium onboarding flow rather than rebuilding them.

## Scope (in this build)

- New wizard route `/_authenticated/onboarding` with 10 steps and autosave
- AI Smart Prefill + AI Description generator (Lovable AI Gateway, `openai/gpt-5.5`)
- Inline AI Assistant sidebar (suggest amenities, improve copy, flag gaps)
- Media pipeline reuses existing compressor + `marketplace-properties` bucket, adds thumbnail + duplicate-hash dedupe
- Rooms managed through existing `units` table with pricing extensions
- Availability + seasonal pricing reuses `marketplace_availability_blocks` + new `unit_seasonal_rates`
- Payments: reuse existing M-Pesa + Paddle wiring (no card processor changes)
- Admin verification extends existing `listings.admin.tsx` (approve / reject / request edits / suspend / verify badge)
- Search: existing marketplace filters + a new `search_property` GIN index

## Out of scope (explicitly, to keep this shippable)

- New card processor (Visa/Mastercard direct) — Paddle already covers cards
- Real "verify business" KYC provider integration — admin manual verify flag only
- Full multilingual generation — English only, structure ready for i18n

## Data model changes (single migration)

```sql
-- Draft autosave for the wizard
create table public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step smallint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  property_id uuid references public.marketplace_properties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend properties with ward + verification + landmarks + postal
alter table public.marketplace_properties
  add column if not exists ward text,
  add column if not exists postal_address text,
  add column if not exists landmarks jsonb default '[]'::jsonb,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid;

-- Seasonal / weekend / holiday pricing per unit
create table public.unit_seasonal_rates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  price numeric(10,2) not null,
  currency text not null default 'KES',
  created_at timestamptz not null default now()
);

-- Perceptual-ish dedupe hash for uploaded images
alter table public.marketplace_property_images
  add column if not exists content_hash text;

-- Search index (trigram) for name+town+county
create extension if not exists pg_trgm;
create index if not exists mkt_properties_search_trgm
  on public.marketplace_properties
  using gin ((name || ' ' || coalesce(town,'') || ' ' || coalesce(county_code,'')) gin_trgm_ops);
```

Grants + RLS follow the existing project pattern (owner+admin write, service_role full, no anon on drafts).

## Server functions & routes

- `src/lib/onboarding.functions.ts` — `getDraft`, `saveDraftStep`, `publishDraft` (creates/updates `marketplace_properties`, moves status to `pending`)
- `src/lib/onboarding-ai.functions.ts` — `aiPrefillProperty`, `aiGenerateDescription`, `aiAssistantSuggest` (all via Lovable AI Gateway)
- Reuse `places.functions.ts` for map search + reverse geocode; add `reverseGeocode` for county/town/ward extraction from a pinned point
- Reuse `marketplace-ops.functions.ts` availability + `units.functions.ts` for rooms; extend units fn with `setSeasonalRate` / `listSeasonalRates`
- Extend `listings.admin.tsx` server fns with `verifyProperty`, `suspendProperty`, `requestEdits` (writes to existing `rejection_reason` + new `is_verified`)

## Wizard UI

```
src/routes/_authenticated/onboarding.tsx        # shell + progress + autosave hook
src/components/onboarding/
  Step1Business.tsx     Step2Location.tsx     Step3AiPrefill.tsx
  Step4Details.tsx      Step5Description.tsx  Step6Media.tsx
  Step7Rooms.tsx        Step8Availability.tsx Step9Payments.tsx
  Step10Review.tsx      AiAssistantPanel.tsx  StepNav.tsx
```

- Zod schema per step, debounced autosave (1s) to `onboarding_drafts.payload`
- Sidebar `AiAssistantPanel` calls `aiAssistantSuggest` with current draft
- Location step embeds Google Map (existing connector key) with draggable pin
- Media step: `compressImage` (already exists) + SHA-256 content hash for dedupe + thumbnail via canvas
- Review step renders the public listing preview and calls `publishDraft`

## Admin verification

Extend `/_authenticated/listings.admin.tsx`:
- Buttons: Approve, Reject (reason), Request edits (reason + reopens draft), Suspend, Toggle Verified badge
- Verified badge shown on marketplace card + detail page

## Search indexing

- `marketplace.functions.ts` `listProperties` gains trigram-based `q` matching using the new GIN index
- Sitemap already includes approved listings — no change needed

## Security & QA

- All server fns validated with Zod, `requireSupabaseAuth` + org-role check via existing `hasOrgRole`
- Rate limit AI endpoints via existing `rate-limit.ts` (10 req/min per user)
- Vitest: schema tests for each step + publish transition
- Playwright smoke: complete wizard from Step 1 → publish

## Technical notes

- AI model: `openai/gpt-5.5` through Lovable AI Gateway (`LOVABLE_API_KEY` already set). Prefill returns structured JSON (Zod-validated) — no proprietary text is scraped; the prompt explicitly restricts to public factual metadata and the model's own paraphrasing.
- Payments: Step 9 shows already-configured M-Pesa + Paddle status and links to their existing setup screens; no new processor is added.
- Draft resume: opening `/onboarding` loads the latest incomplete draft for the org.

## Deliverable

One migration + ~14 files. On merge: new "List your property" CTA in dashboard shell points to `/onboarding`; existing single-page `listings.$id.tsx` remains for quick edits.
