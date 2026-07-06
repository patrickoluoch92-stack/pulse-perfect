# Partner Inventory Sync

HostPulse pulls inbound inventory from **Booking.com Demand API** and **Expedia EPS Rapid**, normalizes it into `external_listings`, and surfaces it in the marketplace alongside HostPulse-native stays.

## Operating modes (no code changes between them)

| Mode    | When it activates                                                        | Behavior |
|---------|--------------------------------------------------------------------------|----------|
| `mock`  | Credentials missing OR `PARTNERS_FORCE_MOCK=true`                        | Deterministic fake listings keyed off the destination |
| `live`  | Credentials present and the provider flag is not disabled                 | Real API calls |
| `disabled` | `BOOKING_COM_DISABLED=true` or `EXPEDIA_DISABLED=true`                  | Skipped in sync runs |

### Credentials (set in env)

- **Booking.com**: `BOOKING_COM_USERNAME`, `BOOKING_COM_PASSWORD`
- **Expedia**: `EXPEDIA_RAPID_API_KEY`, `EXPEDIA_RAPID_SHARED_SECRET`

The app automatically flips each provider from `mock` to `live` as soon as the matching pair appears — no code changes required.

## Database

- `external_listings` — normalized inventory cache (unique on `provider + external_id`).
- `external_sync_runs` — append-only audit of every sync attempt (admin-readable via RLS).

## Admin UI

`/listings/partners` (admin only): provider mode, cached counts, manual sync, cache clear, and last 50 sync runs (auto-refreshes every 15s).

## Scheduling

Cron-callable endpoint: `POST /api/public/hooks/partner-sync`
Auth: send `Authorization: Bearer <PARTNER_SYNC_CRON_SECRET>` (or `x-cron-secret: <PARTNER_SYNC_CRON_SECRET>`) header. The secret is stored server-side only and must never be shipped to the browser.

Example pg_cron + pg_net schedule:

```sql
select cron.schedule(
  'partner-sync-hourly',
  '17 * * * *',
  $$ select net.http_post(
       url := 'https://<host>/api/public/hooks/partner-sync',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.partner_sync_cron_secret')
       ),
       body := '{}'::jsonb
  ); $$
);
```

## Going live checklist

1. Set the four credential env vars listed above.
2. Unset `PARTNERS_FORCE_MOCK`.
3. Open `/listings/partners`; both providers should report `mode = live`.
4. Trigger a manual sync to verify and confirm rows appear in `external_listings`.
