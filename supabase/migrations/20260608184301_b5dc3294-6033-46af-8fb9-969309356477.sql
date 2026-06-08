
CREATE TABLE public.app_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT,
  url TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_errors_org_created_idx ON public.app_errors(org_id, created_at DESC);
CREATE INDEX app_errors_user_created_idx ON public.app_errors(user_id, created_at DESC);

GRANT SELECT, DELETE ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org errors" ON public.app_errors
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Owners delete org errors" ON public.app_errors
  FOR DELETE TO authenticated
  USING (org_id IS NOT NULL AND public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]));

CREATE TABLE public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_events_lookup_idx
  ON public.rate_limit_events(bucket, user_id, created_at DESC);

GRANT SELECT ON public.rate_limit_events TO authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rate limit events" ON public.rate_limit_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
