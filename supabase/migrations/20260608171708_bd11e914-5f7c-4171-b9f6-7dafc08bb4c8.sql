
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS ical_export_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS ical_export_token_expires_at timestamptz;

UPDATE public.units
  SET ical_export_token_created_at = COALESCE(ical_export_token_created_at, now()),
      ical_export_token_expires_at = COALESCE(ical_export_token_expires_at, now() + interval '365 days')
  WHERE ical_export_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ical_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  token_prefix text NOT NULL,
  status text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ical_access_log_unit_idx ON public.ical_access_log(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ical_access_log_org_idx ON public.ical_access_log(org_id, created_at DESC);

GRANT SELECT ON public.ical_access_log TO authenticated;
GRANT ALL ON public.ical_access_log TO service_role;

ALTER TABLE public.ical_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their iCal access log"
  ON public.ical_access_log FOR SELECT
  TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));
