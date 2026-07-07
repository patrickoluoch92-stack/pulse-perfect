
-- Shared knowledge layer -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_property_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  org_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('quality','bookings','search','composite')),
  source_engine TEXT NOT NULL CHECK (source_engine IN ('discovery','revenue','concierge','manual','system')),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, scope)
);
CREATE INDEX IF NOT EXISTS knowledge_property_facts_org_idx ON public.knowledge_property_facts(org_id);
CREATE INDEX IF NOT EXISTS knowledge_property_facts_scope_idx ON public.knowledge_property_facts(scope);
CREATE INDEX IF NOT EXISTS knowledge_property_facts_payload_gin ON public.knowledge_property_facts USING gin(payload);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_property_facts TO authenticated;
GRANT ALL ON public.knowledge_property_facts TO service_role;
ALTER TABLE public.knowledge_property_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_facts_org_read"
  ON public.knowledge_property_facts FOR SELECT
  TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "knowledge_facts_org_write"
  ON public.knowledge_property_facts FOR INSERT
  TO authenticated
  WITH CHECK (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "knowledge_facts_org_update"
  ON public.knowledge_property_facts FOR UPDATE
  TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id))
  WITH CHECK (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "knowledge_facts_org_delete"
  ON public.knowledge_property_facts FOR DELETE
  TO authenticated
  USING (org_id IS NOT NULL AND public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]));

-- History table --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_fact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id UUID NOT NULL REFERENCES public.knowledge_property_facts(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  org_id UUID,
  scope TEXT NOT NULL,
  source_engine TEXT NOT NULL,
  version INT NOT NULL,
  payload JSONB NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_fact_history_fact_idx ON public.knowledge_fact_history(fact_id, version DESC);

GRANT SELECT ON public.knowledge_fact_history TO authenticated;
GRANT ALL ON public.knowledge_fact_history TO service_role;
ALTER TABLE public.knowledge_fact_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_history_org_read"
  ON public.knowledge_fact_history FOR SELECT
  TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

-- Search events --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  user_id UUID,
  engine TEXT NOT NULL CHECK (engine IN ('discovery','concierge','marketplace','revenue')),
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INT NOT NULL DEFAULT 0,
  top_property_ids UUID[] NOT NULL DEFAULT '{}',
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_search_events_engine_idx ON public.knowledge_search_events(engine, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_search_events_org_idx ON public.knowledge_search_events(org_id, created_at DESC);

GRANT SELECT, INSERT ON public.knowledge_search_events TO authenticated;
GRANT ALL ON public.knowledge_search_events TO service_role;
ALTER TABLE public.knowledge_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_search_events_read"
  ON public.knowledge_search_events FOR SELECT
  TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "knowledge_search_events_insert"
  ON public.knowledge_search_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (org_id IS NULL OR public.is_org_member(auth.uid(), org_id))
  );

-- Versioning trigger ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.knowledge_facts_version_bump()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.knowledge_fact_history
    (fact_id, property_id, org_id, scope, source_engine, version, payload, confidence, computed_at)
  VALUES
    (OLD.id, OLD.property_id, OLD.org_id, OLD.scope, OLD.source_engine,
     OLD.version, OLD.payload, OLD.confidence, OLD.computed_at);
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS knowledge_facts_version_bump_trg ON public.knowledge_property_facts;
CREATE TRIGGER knowledge_facts_version_bump_trg
  BEFORE UPDATE ON public.knowledge_property_facts
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_facts_version_bump();

CREATE TRIGGER knowledge_facts_set_updated_at
  BEFORE INSERT ON public.knowledge_property_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
