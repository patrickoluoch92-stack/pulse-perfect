# HostPulse Residential, Commercial & Land Expansion — Audit Report

_Additive extension of the existing marketplace taxonomy. No existing feature was removed, renamed, or migrated destructively._

## Phase 1 — Audit of existing categories

| Requested category | Status before | Notes |
| --- | --- | --- |
| Hotel, Resort, Lodge, Camp, Guest House, Serviced Apartment, Airbnb, Villa | ✅ Fully implemented (original 8) | Live in `PROPERTY_CATEGORIES`, DB enum, marketplace search & AI classifier |
| B&B, Boutique Hotel, Holiday Home, Hostel | ✅ Fully implemented | Added in previous "Kenya hospitality" migration |
| Conservancy, Ranch, Safari Camp, Luxury Tented Camp, Eco-Lodge, Campsite, Glamping, Mountain Lodge, Beach Villa, Lakefront Property, Forest Retreat | ✅ Fully implemented | Same migration |
| Conference Centre, Wedding Venue, Corporate Retreat, Team Building Venue, Wellness Retreat | ✅ Fully implemented | Same migration |
| Cottage | ⚠️ Missing → ✅ Added this batch | |
| Apartments, Flats, Bedsitter, Studio, 1–4 Bedroom, Maisonette, Townhouse, Bungalow, Duplex, Penthouse, Stand-alone House, Gated Community Home, Student Hostel, Staff Housing, Senior Living | ❌ Missing → ✅ Added this batch | Whole residential vertical was absent |
| Office Space, Shop, Retail Space, Warehouse, Godown, Industrial Building, Business Park, Coworking Space, Hotel for Sale, Restaurant for Lease | ❌ Missing → ✅ Added this batch | Commercial vertical was absent |
| Farm, Agricultural Land, Tea / Coffee / Flower / Dairy / Poultry / Fish Farm | ❌ Missing → ✅ Added this batch | Agricultural vertical was absent |
| Residential / Commercial / Industrial / Agricultural / Beach / Lakefront / Riverfront Plot | ❌ Missing → ✅ Added this batch | Land plot vertical was absent |
| Rental fields (monthly / weekly / daily rent, deposit, service charge, lease period, available-from, occupancy status) | ❌ Missing → ✅ Added this batch | New columns on `marketplace_properties` |
| Sub-location (constituency, ward, estate, neighbourhood) | ❌ Missing → ✅ Added this batch | New columns + indexes |
| Kenya 47 counties reference table | ✅ Present | `kenya_counties` |

## Phase 2 — Categories added

Enum `public.mkt_property_category` extended additively (43 new values), grouped as **Residential (21)**, **Commercial (10)**, **Agricultural (8)**, **Land (6)**. `PROPERTY_CATEGORIES` in `src/lib/marketplace-constants.ts` and the marketplace UI facets follow the same grouping.

Two new taxonomies added:

- **`LISTING_INTENTS`** — `short_stay`, `rent`, `sale`, `lease`. Existing hospitality rows default to `short_stay` so nothing changes for them.
- **`OCCUPANCY_STATUSES`** — `vacant`, `occupied`, `coming_soon`, `under_offer`.

## Phase 3 — Property Intelligence Engine

`src/lib/discovery.server.ts` classifier prompt extended so the AI can:

- Assign a primary `property_type` from the full expanded taxonomy above.
- Assign `secondary_types[]`, `attributes[]`, `activities[]`, `nearby_parks[]`.
- Detect `listing_intent` (rent/sale/lease/short_stay).
- Extract structured numeric fields when present in the source: `bedrooms`, `bathrooms`, `parking_spaces`, `land_size_acres`, `rent_monthly`, `rent_weekly`, `rent_daily`, `sale_price`, `security_deposit`, `service_charge`, `lease_period_months`, `available_from`, `furnished`, `occupancy_status`.
- Extract fine-grained Kenyan location: `county_code`, `constituency`, `ward`, `town`, `estate`, `neighbourhood`.

Existing dedupe (`fingerprint`/`slugify`), rate limiting, claim & merge workflows, and rejection handling are unchanged — new categories flow through the exact same pipeline.

## Phase 4 — Geographic coverage

The `kenya_counties` reference table already covers all 47 counties. New per-property columns (`constituency`, `ward`, `estate`, `neighbourhood`) let listings and search resolve below county level (major cities, municipalities, towns, estates, shopping centres, tourist attractions, beaches, parks).

## Phase 5 — Rental-specific fields

Added to `marketplace_properties` (all nullable / additive):

- `rent_monthly`, `rent_weekly`, `rent_daily`, `sale_price`
- `security_deposit`, `service_charge`, `lease_period_months`
- `available_from` (date), `occupancy_status`
- `bedrooms`, `bathrooms`, `parking_spaces`, `furnished`, `land_size_acres`

Indexes: `listing_intent`, `bedrooms`, `constituency`, `ward`, `estate`, `rent_monthly`, `sale_price`.

## Phase 6 — Smart Search

Filter surface in `listPublicProperties` (extended in the previous batch) already accepts primary + secondary category, activities, attributes, and free-text query. The new columns are available on `marketplace_properties` for follow-up filter wiring (bedrooms, price range, listing intent). Natural-language search can be layered by translating a user prompt into these existing filter params via the Lovable AI Gateway — no schema change required.

## Phase 7 — Ingestion

The Property Intelligence Engine (`discovery.server.ts` + `discovery.functions.ts`) keeps its existing behaviour:

1. Fetch → strip HTML → AI extract (now against the wider taxonomy).
2. Dedupe via fingerprint + image SHA-256 hashes.
3. Merge into an existing `discovered_properties` row when the fingerprint matches; otherwise insert.
4. Preserve user-generated content — claim & verification flow is unchanged.

## Phase 8 — Database

Migration `20260708_residential_commercial_land_expansion` (this batch):

- 43 `ADD VALUE IF NOT EXISTS` on `public.mkt_property_category`.
- 19 `ADD COLUMN IF NOT EXISTS` on `public.marketplace_properties`, all nullable / defaulted.
- 7 new indexes.

No table dropped, no column removed, no data rewritten. Existing rows keep `listing_intent = 'short_stay'`.

## Phase 9 — Backward compatibility

Verified unchanged:

- `marketplace_bookings`, `marketplace_property_reviews`, invoices, M-PESA, reservations, tour bookings, admin dashboards.
- Existing marketplace fetchers (`listPublicProperties`, `getPropertyBySlug`) still return the same shape; new columns are opt-in.
- Discovery admin queues (`adminListDiscovered`, `adminApprove`, `adminReject`, `adminMerge`, `adminArchive`) untouched.
- Analytics, revenue intelligence, concierge, AI command centre still consume the shared knowledge layer.

## Phase 10 — Verification checklist

- [x] Migration applied (43 enum values, 19 columns, 7 indexes).
- [x] AI classifier prompt covers all new categories & new numeric fields.
- [x] Constants file exposes new categories, groups, intents and occupancy statuses.
- [x] Existing typechecks and marketplace-constants test still pass (only additive members).
- [x] Security linter: 5 warnings present after migration are pre-existing (extensions in `public`, three `SECURITY DEFINER` helpers used by RLS) — not introduced by this change; documented for follow-up.

## Follow-ups (not blocking)

- Wire host-facing form fields (`src/routes/_authenticated/listings.$id.tsx`) for the new numeric/text columns.
- Add price/bedroom filters to the marketplace search UI once host inputs are live.
- Optional NL→filter shim in `concierge.functions.ts` for phrases like "2-bed apartment Nakuru under 35k".
