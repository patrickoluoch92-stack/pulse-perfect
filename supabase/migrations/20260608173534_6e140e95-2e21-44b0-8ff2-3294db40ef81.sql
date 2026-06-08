
CREATE TABLE public.ical_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
  kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ical_incidents_open_unique
  ON public.ical_incidents (org_id, kind, fingerprint)
  WHERE status <> 'resolved';

CREATE INDEX ical_incidents_org_status_idx
  ON public.ical_incidents (org_id, status, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.ical_incidents TO authenticated;
GRANT ALL ON public.ical_incidents TO service_role;

ALTER TABLE public.ical_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view incidents" ON public.ical_incidents
  FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE POLICY "Org admins insert incidents" ON public.ical_incidents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE POLICY "Org admins update incidents" ON public.ical_incidents
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER ical_incidents_updated_at BEFORE UPDATE ON public.ical_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tighten access log visibility to admins only
DROP POLICY IF EXISTS "Org members can view their iCal access log" ON public.ical_access_log;
CREATE POLICY "Org admins view iCal access log" ON public.ical_access_log
  FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
