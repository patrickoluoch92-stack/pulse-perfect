
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  paused BOOLEAN NOT NULL DEFAULT false,
  concurrency_cap INT NOT NULL DEFAULT 2,
  hourly_cost_budget_usd NUMERIC(10,4) NOT NULL DEFAULT 5.0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai_agents" ON public.ai_agents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update ai_agents" ON public.ai_agents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ai_agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  dedupe_key TEXT,
  priority INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_agent_jobs_dedupe_uk ON public.ai_agent_jobs (agent_slug, dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running');
CREATE INDEX ai_agent_jobs_claim_idx ON public.ai_agent_jobs (status, next_run_at, priority DESC) WHERE status = 'queued';
CREATE INDEX ai_agent_jobs_agent_idx ON public.ai_agent_jobs (agent_slug, status);
GRANT SELECT ON public.ai_agent_jobs TO authenticated;
GRANT ALL ON public.ai_agent_jobs TO service_role;
ALTER TABLE public.ai_agent_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai_agent_jobs" ON public.ai_agent_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  job_id UUID REFERENCES public.ai_agent_jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','skipped','timeout')),
  latency_ms INT,
  tokens_input INT,
  tokens_output INT,
  cost_usd NUMERIC(10,6),
  model TEXT,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_agent_runs_agent_created_idx ON public.ai_agent_runs (agent_slug, created_at DESC);
GRANT SELECT ON public.ai_agent_runs TO authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai_agent_runs" ON public.ai_agent_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ai_agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  subject_type TEXT,
  subject_id TEXT,
  user_id UUID,
  action TEXT NOT NULL,
  confidence NUMERIC(4,3),
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_agent_decisions_subject_idx ON public.ai_agent_decisions (subject_type, subject_id, created_at DESC);
CREATE INDEX ai_agent_decisions_user_idx ON public.ai_agent_decisions (user_id, created_at DESC) WHERE user_id IS NOT NULL;
GRANT SELECT ON public.ai_agent_decisions TO authenticated;
GRANT ALL ON public.ai_agent_decisions TO service_role;
ALTER TABLE public.ai_agent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai_agent_decisions" ON public.ai_agent_decisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users view their decisions" ON public.ai_agent_decisions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.user_preference_vectors (
  user_id UUID PRIMARY KEY,
  embedding vector(3072),
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_preference_vectors TO authenticated;
GRANT ALL ON public.user_preference_vectors TO service_role;
ALTER TABLE public.user_preference_vectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own preference vector" ON public.user_preference_vectors FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ai_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER ai_agents_touch BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER ai_agent_jobs_touch BEFORE UPDATE ON public.ai_agent_jobs FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

INSERT INTO public.ai_agents (slug, display_name, description, concurrency_cap, hourly_cost_budget_usd) VALUES
  ('discovery',      'Property Discovery',     'Crawls approved sources and extracts listings.', 2, 3.0),
  ('verification',   'Property Verification',  'Dedup, contact validity, confidence scoring.',   3, 1.0),
  ('categorization', 'Property Categorization','Assigns hierarchical taxonomy nodes.',           4, 1.0),
  ('market',         'Market Intelligence',    'Regional demand + competitor pricing signals.',  2, 1.5),
  ('recommend',      'Recommendation Engine',  'Personalized ranking + similar properties.',     4, 1.5),
  ('booking',        'Booking Intelligence',   'Booking probability + cancellation risk.',       2, 1.0),
  ('fraud',          'Fraud Detection',        'Anomaly scoring on listings, users, reviews.',   2, 1.0),
  ('enrichment',     'Property Enrichment',    'Nearby POIs, transport, neighborhood context.',  3, 1.5),
  ('vision',         'Image Intelligence',     'Vision tagging + searchable image attributes.',  2, 2.0),
  ('concierge',      'Travel Concierge',       'Conversational assistant with grounded answers.',3, 2.0),
  ('learning',       'Learning Loop',          'Updates preference vectors and demand weights.', 1, 1.0)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS image_ai_tags_labels_gin ON public.image_ai_tags USING gin (labels);
