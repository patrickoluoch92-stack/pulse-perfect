# HostPulse — Deployment Checklist

A pre-launch and per-release checklist. Run top-to-bottom before shipping to production.

## 1. Code & build
- [ ] `bun run lint` clean
- [ ] `bun run test` green (unit + integration in `tests/`)
- [ ] `bun run build` succeeds (Cloudflare Workers SSR target)
- [ ] No unresolved imports, no `console.error` in dev-server log

## 2. Database
- [ ] All migrations under `supabase/migrations/` applied in order
- [ ] Every public-schema table has explicit `GRANT`s + RLS enabled
- [ ] `marketplace_properties`, `marketplace_bookings`, `marketplace_property_reviews`,
      `marketplace_availability_blocks` have current indexes (county/category/price/rating/amenities)
- [ ] `has_role()` SECURITY DEFINER set; `app_role` enum in place
- [ ] Backups verified (Lovable Cloud daily snapshots)

## 3. Auth & roles
- [ ] Google OAuth provider configured
- [ ] Admin users seeded via `user_roles` (never via profile flags)
- [ ] Auth-protected routes live under `_authenticated/`
- [ ] No `requireSupabaseAuth` server fn called from a public route loader

## 4. Payments (M-Pesa STK + Paddle)
- [ ] STK callback URL whitelisted in Daraja
- [ ] Webhook signatures verified (`/api/public/*` handlers)
- [ ] Webhook idempotency table active; replays are no-ops
- [ ] Invoice status transitions guarded server-side
- [ ] Test transaction reconciled end-to-end

## 5. Marketplace
- [ ] 47 counties present in `kenya_counties`
- [ ] Property categories: hotel, resort, lodge, camp, guest_house,
      serviced_apartment, airbnb, villa
- [ ] Image bucket `marketplace-properties` public-read, owner-write RLS
- [ ] Sitemap (`/sitemap.xml`) returns 200 with counties + approved listings
- [ ] Map view loads with Google Maps key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`)

## 6. SEO & metadata
- [ ] Root + per-route titles, descriptions, OG, Twitter cards
- [ ] Single H1 per page; alt text on images
- [ ] Canonical tags on listing detail pages
- [ ] Robots.txt + sitemap referenced

## 7. Performance
- [ ] Web vitals reporting active (`src/lib/perf.ts` → `/api/public/web-vitals`)
- [ ] LCP < 2.5s on listing & home (mobile, 3G fast)
- [ ] CLS < 0.1, INP < 200ms
- [ ] Images compressed pre-upload (`src/lib/image-compress.ts`)
- [ ] No N+1 queries in slow-query log

## 8. Mobile responsiveness
- [ ] Smoke test at 375px and 458px widths
- [ ] Tap targets ≥ 44px, no horizontal scroll
- [ ] Map view + booking dialog usable on mobile
- [ ] Admin tables collapse / scroll horizontally on small screens

## 9. Monitoring & alerts
- [ ] `lovable-error-reporting` wired in root error boundary
- [ ] Web-vitals logs visible in Cloudflare/Lovable logs
- [ ] Slow query review scheduled (weekly)
- [ ] Security scan: no unresolved critical findings

## 10. Final
- [ ] Lovable Cloud connected (Backend tab healthy)
- [ ] Custom domain DNS verified (if applicable)
- [ ] Privacy policy + Terms pages reachable from footer
- [ ] Publish → smoke test the live URL
