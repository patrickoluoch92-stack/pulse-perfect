# HostPulse Mobility → Vehicle Rental & Fleet Management Ecosystem

Scope is very large. To keep each change reviewable and avoid breaking the live Car Hire flow, I'll deliver in batches. Each batch ends with a working preview; nothing is dropped until its replacement is live.

## 0. Audit (no code change)
Confirm current state of:
- `mobility_providers / vehicles / rates / images / seasonal_rates / availability_blocks / bookings / reviews`
- `src/lib/mobility.functions.ts`, `src/routes/_authenticated/mobility*`, public `mobility.*` routes
- Existing hooks into finance, commissions, notifications, RBAC, AI orchestrator.

Deliverable: short gap list in `docs/MOBILITY_AUDIT.md`.

## 1. Data model refactor (single migration)
Extend, don't replace:
- `mobility_providers`: add `cover_image_url` (exists), `branches jsonb`, `years_in_business`, `operating_hours jsonb`, `social jsonb`, `ai_summary`, `accepts_private_vehicles bool`, `private_owner_commission_pct numeric`, `private_owner_quality_min int`.
- New `mobility_branches` (org, provider, county, town, geo, address, hours).
- New `mobility_private_owners` (user, KRA PIN encrypted, verification, payout).
- New `mobility_vehicle_submissions` (private_owner → provider workflow: pending/approved/rejected/withdrawn, terms snapshot, commission_pct).
- `mobility_vehicles`: add `registration_no`, `fleet_no`, `vin` (private), `variant`, `body_type`, `drive_type`, `mileage_km`, `owner_type` (`company|private`), `private_owner_id`, `submission_id`, `quality_score`, `ai_flags jsonb`, `instant_book bool`, `min_rental_hours`, `mileage_limit_km_per_day`, `extra_km_kes`, `insurance jsonb`, `deposit_kes`, `delivery_fee_kes`, `chauffeur_available bool`, `self_drive_available bool`, `documents jsonb` (refs to storage).
- New `mobility_vehicle_documents` (vehicle, type, url, expires_at, verified_by).
- New `mobility_maintenance` (vehicle, type, scheduled_at, done_at, cost_kes, notes, status).
- New `mobility_pricing_tiers` extend rates with `tier` (daily/weekend/weekly/monthly/lease/corporate/holiday/peak), `starts_at`, `ends_at`.
- New `mobility_payouts` view/table linked to existing `payouts` + `booking_commissions` with `source='mobility'`.
- `mobility_bookings`: add `mileage_start/end`, `fuel_start/end`, `damage_report jsonb`, `chauffeur_id`, `delivery_address`, `extension_of` self-ref.
- RLS: public sees only approved, non-archived; org staff via `is_org_member` + role; private owners see their own submissions + resulting bookings; admin bypass via `has_role`. Column-level revoke of `vin`, `documents`, guest PII columns from `anon`.
- GRANTs + RLS + policies inline for every new table.
- RBAC seed: `mobility.manage`, `mobility.fleet.write`, `mobility.bookings.manage`, `mobility.payouts.read`, `mobility.private_owner.review`.

## 2. Server functions (`src/lib/mobility.functions.ts` + `mobility.server.ts`)
- Provider: branches CRUD, staff invite (reuse `team.functions`), settings for private-vehicle policy.
- Fleet: vehicle CRUD w/ Zod schema covering every new field; document upload signed URL flow; maintenance CRUD; pricing tiers CRUD; availability + calendar; instant/request-book toggles.
- Private owner: register, submit vehicle to provider, list my submissions, withdraw.
- Provider review queue: list pending submissions, approve/reject (creates linked `mobility_vehicles` row with `owner_type='private'`).
- Search: extend `searchMobilityVehicles` with all new filters (drive type, body, features array via `@>`, instant_book, verified_only, price bands, 4WD/EV/hybrid).
- Bookings: quote (with mileage/delivery/deposit), create, extend, cancel, chat handoff, invoice.
- Payouts: statement generator per provider + per private owner.
- AI: `scoreVehicleListing` (quality + duplicate + description improvements) via `ai.server.ts`; `recommendPricing`; `forecastDemand`; hooked into `ai-orchestrator` as `mobility.enrichment.agent`.

## 3. Provider dashboard UI (`_authenticated/mobility.*`)
- `mobility.tsx` — KPI hub (fleet, revenue, utilization, alerts, private-owner queue).
- `mobility.fleet.tsx` — table + filters + bulk actions.
- `mobility.manage.$id.tsx` — expand existing tabs (Details, Media, Docs, Pricing Tiers, Seasonal, Availability, Maintenance, Bookings, Reviews, AI Insights).
- `mobility.branches.tsx`, `mobility.staff.tsx` (reuses team invites).
- `mobility.submissions.tsx` — private-owner review queue.
- `mobility.payouts.tsx`, `mobility.analytics.tsx`.

## 4. Private-owner dashboard
- `_authenticated/mobility.owner.tsx` — my vehicles, submissions, bookings, payouts, docs, messages.
- Submit-vehicle wizard that targets one or more accepting providers.

## 5. Platform admin
- `_authenticated/admin.mobility.tsx` — provider verification queue, private-owner verification, commission overrides, disputes, moderation, AI service toggles.

## 6. Public surfaces
- Extend existing `mobility.index / $category / v.$slug / companies / company.$slug` with new filters, quality badges, verified-company badges, JSON-LD `Vehicle` + `Product`, and updated head() metadata.
- Sitemap + `discover` integration.

## 7. AI + integrations
- Listing gate: `scoreVehicleListing` runs on submit-for-review; block publish under threshold, surface reasons.
- Planner AI: extend `fetchMobilityForPlan` with new signals (instant_book, 4WD for safari, EV for city).
- Recommendations: emit `recommendation_events` for mobility; RPC `recommend_vehicles_for_user`.
- Executive dashboard: mobility GMV, utilization, top providers.
- Finance: `booking_commissions.source='mobility'`, split company/private-owner/platform.
- Notifications: reuse booking notification path for mobility bookings, submissions, maintenance.

## 8. QA / hardening
- RLS tests for private-owner isolation and PII columns.
- Vitest for pricing quote + extension math.
- Playwright smoke: company onboarding → vehicle create → AI gate → publish → search → book → provider approves → review.
- Rate limiting on submissions and search.

## Ordering
Batch 1 → migration only (needs your approval before I write dependent code).
Batches 2–8 land sequentially, each self-contained and previewable.

## Non-goals (explicit)
- No motorcycle/boat category rollout yet (schema-ready, UI hidden).
- No escrow (schema hook only).
- No native mobile app.

Reply **approve batch 1** to start with the migration, or tell me which batches to reorder/skip.
