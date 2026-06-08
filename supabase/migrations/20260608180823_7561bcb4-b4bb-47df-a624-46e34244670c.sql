
CREATE TABLE public.ical_webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_id UUID NOT NULL REFERENCES public.ical_incident_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  http_status INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ical_webhook_deliveries_org_idx ON public.ical_webhook_deliveries(org_id, created_at DESC);
CREATE INDEX ical_webhook_deliveries_hook_idx ON public.ical_webhook_deliveries(webhook_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ical_webhook_deliveries TO authenticated;
GRANT ALL ON public.ical_webhook_deliveries TO service_role;

ALTER TABLE public.ical_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view webhook deliveries"
  ON public.ical_webhook_deliveries FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

CREATE POLICY "Org admins insert webhook deliveries"
  ON public.ical_webhook_deliveries FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

CREATE POLICY "Org admins update webhook deliveries"
  ON public.ical_webhook_deliveries FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

CREATE TRIGGER ical_webhook_deliveries_updated_at
  BEFORE UPDATE ON public.ical_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
