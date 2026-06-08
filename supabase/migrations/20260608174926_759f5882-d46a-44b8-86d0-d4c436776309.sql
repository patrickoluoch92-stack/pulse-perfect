
CREATE TABLE public.ical_incident_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_status text,
  last_error text,
  last_delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ical_incident_webhooks_org_idx ON public.ical_incident_webhooks(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ical_incident_webhooks TO authenticated;
GRANT ALL ON public.ical_incident_webhooks TO service_role;
ALTER TABLE public.ical_incident_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view incident webhooks"
  ON public.ical_incident_webhooks FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Org admins insert incident webhooks"
  ON public.ical_incident_webhooks FOR INSERT TO authenticated
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Org admins update incident webhooks"
  ON public.ical_incident_webhooks FOR UPDATE TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]))
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Org admins delete incident webhooks"
  ON public.ical_incident_webhooks FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));

CREATE TRIGGER ical_incident_webhooks_updated_at
  BEFORE UPDATE ON public.ical_incident_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ical_incident_retention_days integer NOT NULL DEFAULT 90
    CHECK (ical_incident_retention_days BETWEEN 7 AND 3650);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'ical-incident-retention',
  '17 3 * * *',
  $$
  DELETE FROM public.ical_incidents i
   WHERE i.status = 'resolved'
     AND i.resolved_at IS NOT NULL
     AND i.resolved_at < now() - (
       COALESCE(
         (SELECT o.ical_incident_retention_days FROM public.organizations o WHERE o.id = i.org_id),
         90
       ) || ' days'
     )::interval;

  DELETE FROM public.ical_access_log
   WHERE created_at < now() - interval '180 days';
  $$
);
