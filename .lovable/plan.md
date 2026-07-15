
# Mobility Refactor — Company-First Onboarding

Goal: make the **Rental Company** the primary entity. Vehicles can only exist under a verified company. Private owners submit into a company's fleet and never publish directly. Preserve everything that already works (search, quotes, bookings, reviews, payouts, submissions, docs, maintenance, tiers).

Delivered in reviewable batches. Each batch ends previewable; nothing is dropped until its replacement is live.

## Current state (from audit)

Already in place and kept:
- `mobility_providers` (company), `mobility_branches`, `mobility_vehicles` (+ images/rates/tiers/seasonal/availability/maintenance/documents), `mobility_bookings`, `mobility_reviews`, `mobility_private_owners`, `mobility_vehicle_submissions`, `mobility_owner_payout_requests`.
- Server fns: `mobility.functions.ts` (search, quote, bookings, reviews), `mobility-ext.functions.ts` (owner + submissions + payouts).
- Routes: `_authenticated/mobility.tsx` (KPI hub), `mobility.manage.$id.tsx` (per-vehicle tabs), `mobility.owner.tsx`, `mobility.submissions.tsx`, plus public `mobility.index/$category/v.$slug/companies/company.$slug`.

Gaps vs. spec:
1. Landing `/mobility` doesn't force the two-path choice ("I own a rental company" vs "I own a vehicle").
2. No dedicated **Register Rental Company** wizard — company fields live inside the KPI hub.
3. Fleet view mixes company-owned + private + statuses in one list.
4. No `accepts_private_vehicles` toggle surfaced with a gated "Private Fleet Management" menu.
5. Review panel exists but lacks Quality Score / AI recommendation / auto-approval rules per company.
6. Revenue-sharing % (company / private owner / platform) isn't editable per company.
7. Public listings don't strictly gate on "belongs to a verified company + approved vehicle."

## Batches

### Batch A — Data model deltas (single migration)
- `mobility_providers`: add `business_registration_no`, `kra_pin_encrypted`, `address_line`, `geo_lat`, `geo_lng`, `phone`, `email`, `website`, `operating_hours jsonb`, `commission_company_pct`, `commission_private_owner_pct`, `commission_platform_pct`, `auto_approve_rules jsonb`, `payout_schedule` (`weekly|biweekly|monthly`).
- `accepts_private_vehicles` already present — confirm + default `false`.
- `mobility_vehicles`: add `quality_score numeric`, `ai_recommendation jsonb`, `owner_type` (`company|private`) — already present; ensure NOT NULL default `company`.
- **Public-visibility rule**: RLS on `mobility_vehicles` for `anon`/`authenticated` narrows to `status='active' AND is_archived=false AND EXISTS (provider verified) AND (owner_type='company' OR submission.status='approved')`. Same predicate on `mobility_vehicle_images` join.
- KRA PIN stored via `pgcrypto` symmetric enc with `vault`-style key; column-level `REVOKE` from `anon/authenticated`, exposed only through a security-definer fn to org admins.
- New helper fn `public.mobility_is_company_admin(_user_id uuid, _provider_id uuid)` used by policies.

### Batch B — Server functions
`src/lib/mobility-company.functions.ts` (new):
- `registerRentalCompany` (creates org if missing → provider row → default commissions → wallet).
- `updateCompanyProfile`, `updateCompanyCommissions`, `togglePrivateVehicleProgram`, `updateAutoApproveRules`.
- `listCompanyFleet({ providerId, bucket })` where bucket ∈ `company_owned | private_owned | pending | maintenance | booked | available | inactive | archived`.
- `getCompanyDashboardKPIs`.

Extend `mobility-ext.functions.ts`:
- Submission decisioning applies `auto_approve_rules` (min photos, valid docs, min quality score).
- On approve → set vehicle `owner_type='private'`, link submission, publish only after verified provider.

Extend `mobility.functions.ts`:
- `computeMobilityQuote` unchanged, but booking creation writes commission split rows using the provider's configured %.
- `searchMobilityVehicles` already joins provider; add `provider.verification_status='verified'` filter and enforce approval predicate.

### Batch C — Onboarding UX
- `src/routes/mobility.index.tsx`: hero gets two primary CTAs → **/mobility/register-company** and **/mobility/owner**. Keep existing browse-by-category and featured vehicles below.
- New `src/routes/_authenticated/mobility.register-company.tsx`: multi-step wizard (Identity → Location → Contact → Hours/Branches → Commissions → Review). On submit → provider row + redirect to dashboard.
- Keep `/mobility/owner` as private-owner onboarding entry.

### Batch D — Company Dashboard shell
Refactor `src/routes/_authenticated/mobility.tsx` into a shell with tabs/sub-routes:
- Overview (KPIs) · Fleet · Bookings · Customers · Revenue · Analytics · Staff · Branches · Private Requests (gated) · Settings · AI Insights.

New leaf routes (thin, reuse existing data fns):
- `mobility.fleet.tsx` — bucketed tabs (Company-Owned / Private / Pending / Maintenance / Booked / Available / Inactive / Archived) using `listCompanyFleet`.
- `mobility.bookings.tsx`, `mobility.customers.tsx`, `mobility.revenue.tsx`, `mobility.analytics.tsx`, `mobility.staff.tsx`, `mobility.branches.tsx`, `mobility.settings.tsx`, `mobility.ai.tsx`.
- `mobility.private-requests.tsx` — visible only when `accepts_private_vehicles=true`; wraps existing submissions queue and adds Quality Score + AI recommendation + auto-rule editor.

Existing `mobility.manage.$id.tsx` is kept and linked from Fleet.

### Batch E — Private Owner journey
- Keep `mobility.owner.tsx`. Ensure submission flow requires selecting a rental company from providers where `accepts_private_vehicles=true`.
- Add missing sections to owner dashboard: Messages placeholder, Performance card, "Companies I work with" list derived from approved submissions.
- Owner vehicles never appear in public search until submission is approved and provider is verified (enforced in RLS, Batch A).

### Batch F — Revenue sharing & payouts
- Settings tab surfaces commission % editor + payout schedule.
- Booking-completion path writes split into `booking_commissions` using provider config; existing payout tables consume it.

### Batch G — Public gating & QA
- Verify `/mobility`, `/mobility/$category`, `/mobility/v/$slug`, `/mobility/companies`, `/mobility/company/$slug` only show verified-company + approved vehicles.
- Add small vitest around commission split + fleet bucketing.
- Manual smoke: register company → toggle private program → owner submits → company approves → vehicle public → booking → split.

## Non-goals
- No new vehicle attribute additions beyond quality/AI fields.
- No native messaging system (Messages remains a placeholder linking to existing channels).
- No change to public URLs/SEO structure.

## Ordering
A → B → C → D → E → F → G. Each batch is self-contained and preserves the current live flow until its successor is wired.

Reply **approve batch A** to start with the migration, or tell me which batches to reorder/skip.
