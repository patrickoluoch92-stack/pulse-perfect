# Monitoring & Alerts

HostPulse uses a layered, low-cost monitoring stack that runs entirely inside
Lovable Cloud + Cloudflare Workers logs. No third-party APM required.

## 1. Client error reporting
- `src/lib/lovable-error-reporting.ts` ships every unhandled React error
  surfaced by the root `errorComponent` boundary.
- Wired in `src/routes/__root.tsx`. Do not remove the `reportLovableError`
  call without replacing it.

## 2. Web vitals (RUM)
- `src/lib/perf.ts` collects LCP, CLS, INP, FCP, TTFB using the native
  `PerformanceObserver`. No dependency on the `web-vitals` npm package.
- Metrics are sent via `navigator.sendBeacon` to
  `POST /api/public/web-vitals`, which logs a structured `[web-vitals]`
  line. Grep Cloudflare logs to chart trends.

## 3. Server-side observability
- `src/lib/observability.functions.ts` exposes structured telemetry helpers.
- `src/lib/correlation.ts` propagates request IDs into server function logs
  for cross-service tracing.

## 4. Database health
- Use `supabase--slow_queries` weekly. Target: no query > 250ms p95.
- Use `supabase--linter` after every migration.

## 5. Security scans
- Run `security--run_security_scan` after schema changes.
- Triage results with `security--manage_security_finding`. Update
  `@security-memory` after ignoring anything.

## 6. Alert thresholds (manual until paged-alerts ship)
| Signal              | Warn               | Page                |
| ------------------- | ------------------ | ------------------- |
| LCP (mobile p75)    | > 2.5s             | > 4s                |
| Error rate (5m)     | > 1% requests      | > 5% requests       |
| STK callback fails  | > 2 in 10m         | > 10 in 10m         |
| Slow query (mean)   | > 250ms            | > 1s                |
| DB connections      | > 60% pool         | > 85% pool          |

## 7. Runbook entry points
- Payments stuck: check `mpesa_transactions` + webhook idempotency table.
- 5xx spike: tail Cloudflare logs, then check the latest deploy diff.
- Listings missing: confirm RLS policies + `kenya_counties` row exists.
