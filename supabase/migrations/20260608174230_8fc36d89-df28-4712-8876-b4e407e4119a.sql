
CREATE TABLE public.ical_incident_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.ical_incidents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('opened','updated','acknowledged','resolved','reopened','note')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ical_incident_audit_incident_idx ON public.ical_incident_audit(incident_id, created_at DESC);
CREATE INDEX ical_incident_audit_org_idx ON public.ical_incident_audit(org_id, created_at DESC);

GRANT SELECT, INSERT ON public.ical_incident_audit TO authenticated;
GRANT ALL ON public.ical_incident_audit TO service_role;
ALTER TABLE public.ical_incident_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view incident audit"
  ON public.ical_incident_audit FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));

CREATE POLICY "Org admins insert incident audit"
  ON public.ical_incident_audit FOR INSERT TO authenticated
  WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));

CREATE TABLE public.ical_incident_reads (
  incident_id uuid NOT NULL REFERENCES public.ical_incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.ical_incident_reads TO authenticated;
GRANT ALL ON public.ical_incident_reads TO service_role;
ALTER TABLE public.ical_incident_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own incident reads"
  ON public.ical_incident_reads FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
