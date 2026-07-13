# HostPulse Mobility & Car Rental Integration — Implementation Plan

Deliver a fully integrated Car Hire & Mobility module that plugs into the existing Tours & Travel ecosystem (marketplace, bookings, payments, reviews, notifications, analytics, AI Recs, Property Intelligence, Planner AI) — not as a standalone silo.

## 1. Data model (single migration)

New tables in `public` (each with `authenticated` + `service_role` GRANTs, RLS, and org-scoped policies mirroring `marketplace_properties`):

- `mobility_providers` — verified car-hire companies. Fields: `org_id`, `name`, `slug`, `logo_url`, `bio`, `contact_*`, `verification_status`, `rating_avg`, `rating_count`, `service_areas jsonb`.
- `mobility_vehicles` — one row per vehicle/fleet unit. Fields: `provider_id`, `org_id`, `slug`, `category` (enum: `self_drive`, `chauffeur`, `airport_transfer`, `executive`, `tour_van`, `safari_4x4`, `luxury`, `wedding`, `shuttle`, `bus`, `motorcycle`, `bicycle`, `boat`), `make`, `model`, `year`, `transmission` (auto/manual), `fuel_type`, `seats`, `luggage`, `has_ac`, `has_gps`, `insurance_info jsonb`, `security_deposit_kes`, `pickup_locations jsonb`, `dropoff_locations jsonb`, `county_code`, `town`, `status` (draft/pending/approved/rejected), `is_featured`, `description`, `embedding vector(3072)`.
- `mobility_vehicle_rates` — pricing tiers: `vehicle_id`, `unit` (hour/day/week/month), `price_kes`, `min_units`, `included_km`, `extra_km_kes`.
- `mobility_vehicle_images` — `vehicle_id`, `url`, `sort_order`, `alt`.
- `mobility_availability_blocks` — `vehicle_id`, `start_at`, `end_at`, `reason`, `booking_id`.
- `mobility_bookings` — `vehicle_id`, `provider_id`, `org_id`, `guest_user_id`, `pickup_at`, `dropoff_at`, `pickup_location`, `dropoff_location`, `driver_option` (self/chauffeur), `total_kes`, `deposit_kes`, `status` (pending/confirmed/in_progress/completed/cancelled), `payment_status`, `payment_ref`. Reuses booking status machinery.
- `mobility_reviews` — mirrors `marketplace_property_reviews` shape (rating + comment, moderation).

RLS pattern: public `SELECT` on approved vehicles/providers (safe columns only, contact PII revoked at column grant); org members manage their own fleet via `is_org_member`; guests see their own bookings; admins bypass via `has_role`.

Extend `mkt_property_category` — not needed; mobility uses its own enum. But add `mobility` scope to search facets and Planner grounding.

## 2. Server functions (`src/lib/mobility.functions.ts` + `mobility.server.ts`)

All authenticated via `requireSupabaseAuth`, org-scoped via `requireOrgRole`/`requirePermission`:

- Provider CRUD: `upsertProvider`, `getProvider`, `listMyProviders`.
- Vehicle CRUD: `upsertVehicle` (Zod schema for all listing fields), `submitVehicleForReview`, `listMyVehicles`, `getVehicle`.
- Rates: `setVehicleRates`.
- Images: `addVehicleImage`, `reorderVehicleImages`, `deleteVehicleImage`.
- Availability: `blockVehicleDates`, `unblockVehicleDates`, `getVehicleAvailability`.
- Public search (server publishable client, `anon` SELECT policy): `searchVehicles({ category?, county?, town?, seats?, transmission?, priceMax?, pickupDate?, dropoffDate?, query? })`, `getPublicVehicle(slug)`.
- Bookings: `quoteVehicleBooking`, `createVehicleBooking`, `confirmVehicleBooking`, `cancelVehicleBooking`, `listVehicleBookings`.
- Reviews: `submitVehicleReview`, `moderateVehicleReview`.
- Analytics: `getProviderAnalytics` (revenue, occupancy, top vehicles, review score).

Payments: reuse existing M-Pesa + Paddle server flows — call `finance.server.ts` commission logic (`booking_commissions`) with `source='mobility'`.

## 3. Public routes

- `src/routes/mobility.index.tsx` — hub landing (categories grid, hero, Plan-with-AI CTA seeded `module=travel, need=transport`).
- `src/routes/mobility.$category.tsx` — category listing (e.g. `/mobility/safari-4x4`).
- `src/routes/mobility.v.$slug.tsx` — vehicle detail (gallery, specs, rates, availability calendar, reviews, book CTA).
- `src/routes/mobility.county.$county.tsx` — county-scoped listings for SEO.
- Each route with proper `head()` (title/description/og:title/og:description; og:image only on leaf with real vehicle photo).
- Sitemap: extend `src/routes/sitemap[.]xml.ts` to include approved vehicles.

## 4. Authenticated dashboard routes

- `src/routes/_authenticated/mobility.tsx` — provider dashboard hub (fleet overview, bookings, revenue KPIs).
- `src/routes/_authenticated/mobility.fleet.tsx` — vehicle list + add.
- `src/routes/_authenticated/mobility.fleet.$id.tsx` — edit vehicle (specs, images, rates, availability, pickup/dropoff).
- `src/routes/_authenticated/mobility.bookings.tsx` — inbound bookings queue.
- `src/routes/_authenticated/mobility.analytics.tsx` — revenue, occupancy, top vehicles.
- `src/routes/_authenticated/admin.mobility.tsx` — moderation queue (approve/reject vehicles + providers).

Nav: add "Mobility" section to `src/components/dashboard-shell.tsx`, gated by a new `mobility.manage` RBAC permission (seeded to `owner`, `enterprise_admin`, `admin`, `manager`).

## 5. Integration points

- **Planner AI** (`src/lib/planner.functions.ts`): in `fetchProperties`, also fetch relevant `mobility_vehicles` via a new `fetchMobilityForPlan(query, county, module)`. Extend `PlanSchema` with `recommendedVehicles` (slug list). Update system prompt: "Recommend suitable vehicles alongside accommodation for travel/safari/wedding/business/weekend modules — reference by slug." Enrich response with real vehicle lookups.
- **Property Intelligence / Recommendations**: emit `recommendation_events` on view/book. Add `recommend_vehicles_for_user` RPC mirroring `recommend_for_user`.
- **Search**: add a Mobility tab on `src/routes/marketplace.index.tsx` that routes to `mobility.index`. Cross-link on property detail page ("Getting there — vehicles near this property").
- **Maps**: reuse existing map component; add vehicle pickup markers on `mobility.map` (optional deferred).
- **Reviews**: reuse `PropertyReviews` shape with a `mobility` variant.
- **Notifications**: reuse existing booking notification path (guest + provider) keyed on `mobility_bookings`.
- **Analytics/Executive**: add mobility KPIs to `getExecutiveOverview` (GMV, active vehicles, top providers).
- **Finance**: commission rules extended to include a `mobility` scope; wire `booking_commissions.source='mobility'`.
- **AI Ops**: add `mobility.enrichment.agent` (image tagging + embedding backfill) reusing `enrichment-tick.server.ts`.
- **SEO**: `discover`/`sitemap`/JSON-LD (`Product` + `Vehicle` schema) on vehicle detail.

## 6. Ordering & delivery

Batches (each a small, verifiable step):

1. Migration (tables, enums, RLS, GRANTs, RPC helpers, permission seed).
2. Server functions + Zod schemas.
3. Provider dashboard (fleet CRUD + images + rates + availability).
4. Public routes (hub, category, detail, county) + SEO.
5. Booking flow (quote → create → payment → confirm) + reviews.
6. Planner AI integration (grounding, schema field, UI card for recommended vehicles on `planner.tsx`).
7. Cross-surface integration (marketplace tab, property detail cross-link, executive KPIs, sitemap, discover).
8. Admin moderation route + analytics + notifications wiring.

No changes to auto-generated files (`types.ts`, `client.ts`, `routeTree.gen.ts`). Types regenerate after the migration is approved.

## Technical notes

- All server-only helpers live in `mobility.server.ts` (imported inside handlers only).
- Column-level `REVOKE SELECT` on `mobility_providers.contact_email/phone` from `anon`; expose only through booking flow.
- `mobility_bookings` guest PII gated by role (guest, provider org roles, admin) — same pattern used for `marketplace_bookings`.
- Availability collision check enforced by an exclusion constraint on `mobility_availability_blocks` (using `btree_gist` already present) `EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, end_at) WITH &&)`.
- Extend `sitemap.xml`, `llms.txt`, and JSON-LD.

Ready to start with Batch 1 (migration) on approval.
