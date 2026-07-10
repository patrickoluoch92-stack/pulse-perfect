CREATE TABLE IF NOT EXISTS public.planner_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('rental','travel','stay','event','business','family','honeymoon','student','weekend','general')),
  title TEXT,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_sessions TO authenticated;
GRANT ALL ON public.planner_sessions TO service_role;

ALTER TABLE public.planner_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_sessions_owner_all"
  ON public.planner_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planner_sessions_admin_read"
  ON public.planner_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS planner_sessions_user_idx ON public.planner_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS planner_sessions_module_idx ON public.planner_sessions(module, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_planner_sessions_updated_at ON public.planner_sessions;
CREATE TRIGGER trg_planner_sessions_updated_at
  BEFORE UPDATE ON public.planner_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();