# AI Property Intelligence & Discovery Engine

Continuously discovers Kenyan accommodation businesses from public sources, classifies them with AI, deduplicates, quality-scores, and hands them to admins for verification.

## Architecture

```
pg_cron → /api/public/hooks/discovery-tick → crawlNextSource()
                                                   ↓
                     fetch → strip HTML → Lovable AI (gpt-5.5) → structured JSON
                                                   ↓
                              upsert public.discovered_properties (with quality_score, fingerprint)
                                                   ↓
                              admin console at /listings/admin/discovery
```

## Tables

- `discovery_sources` — allow-listed URLs (directories, county pages, owner-submitted)
- `discovered_properties` — draft candidate accommodations
- `discovery_runs` — per-crawl audit
- `property_claims` — owner claim + 6-digit email OTP
- `property_merge_audit` — admin merge trail
- `discovery_feedback` — admin/owner edits (feeds future AI context)

Blocked hosts (never crawled): booking.com, expedia.com, airbnb.com, tripadvisor.com, hotels.com, agoda.com, vrbo.com.

## Manual test

Sign in as an admin, open **Discovery AI** in the sidebar, click **Run crawl now**.

## Scheduling with pg_cron

Copy your `PARTNER_SYNC_CRON_SECRET` value from Project Settings → Secrets, then run in the SQL editor:

```sql
select cron.schedule(
  'discovery-tick',
  '*/17 * * * *',
  $$
  select net.http_post(
    url := 'https://project--61266718-973b-43aa-9dae-25edfc6e25d2.lovable.app/api/public/hooks/discovery-tick',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_PARTNER_SYNC_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'discovery-rescore',
  '15 3 * * *',
  $$
  select net.http_post(
    url := 'https://project--61266718-973b-43aa-9dae-25edfc6e25d2.lovable.app/api/public/hooks/discovery-rescore',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_PARTNER_SYNC_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Public routes

- `/discover` — browse all discovered accommodations
- `/discover/$slug` — detail page with "Claim this property" CTA

## Admin console

- `/listings/admin/discovery` — Pending / Claimed / Approved / Rejected queues, duplicate groups, live crawl trigger, county coverage stats.

## AI safety

- Never copies guest reviews, ratings, prices or copyrighted marketing text.
- AI generates original SEO descriptions from factual details only.
- Per-record confidence scores captured in `ai_confidence` jsonb.
- All admin state changes recorded in `property_merge_audit`.
