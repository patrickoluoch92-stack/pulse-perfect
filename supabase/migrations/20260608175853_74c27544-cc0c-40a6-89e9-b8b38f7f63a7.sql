ALTER TABLE public.ical_incident_webhooks
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ical_access_log_retention_days integer NOT NULL DEFAULT 180
    CHECK (ical_access_log_retention_days >= 7 AND ical_access_log_retention_days <= 3650);

-- Replace prior fixed-180-day prune with per-org retention.
DO $$ BEGIN
  PERFORM cron.unschedule('prune-ical-access-log');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'prune-ical-access-log',
  '15 3 * * *',
  $$
  DELETE FROM public.ical_access_log l
  USING public.organizations o
  WHERE l.org_id = o.id
    AND l.created_at < now() - (o.ical_access_log_retention_days || ' days')::interval;
  $$
);