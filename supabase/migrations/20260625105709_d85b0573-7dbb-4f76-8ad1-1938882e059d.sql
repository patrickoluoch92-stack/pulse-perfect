CREATE TABLE public.external_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('booking','expedia')),
  destination text,
  mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live','mock')),
  status text NOT NULL CHECK (status IN ('pending','success','failed','skipped')),
  items_found integer NOT NULL DEFAULT 0,
  items_upserted integer NOT NULL DEFAULT 0,
  error_message text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX external_sync_runs_started_idx ON public.external_sync_runs (started_at DESC);
CREATE INDEX external_sync_runs_provider_idx ON public.external_sync_runs (provider, started_at DESC);

GRANT SELECT ON public.external_sync_runs TO authenticated;
GRANT ALL ON public.external_sync_runs TO service_role;

ALTER TABLE public.external_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view partner sync runs"
  ON public.external_sync_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));