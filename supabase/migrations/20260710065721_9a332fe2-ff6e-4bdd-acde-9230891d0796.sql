
CREATE TABLE public.recommendation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NULL,
  property_id UUID NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view','click','save','unsave','book','dismiss')),
  weight NUMERIC NOT NULL DEFAULT 1.0,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recommendation_events_user_idx ON public.recommendation_events (user_id, created_at DESC);
CREATE INDEX recommendation_events_session_idx ON public.recommendation_events (session_id, created_at DESC);
CREATE INDEX recommendation_events_property_idx ON public.recommendation_events (property_id, created_at DESC);
CREATE INDEX recommendation_events_type_idx ON public.recommendation_events (event_type, created_at DESC);

GRANT SELECT, INSERT ON public.recommendation_events TO authenticated;
GRANT SELECT, INSERT ON public.recommendation_events TO anon;
GRANT ALL ON public.recommendation_events TO service_role;

ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) may log their own event; must include either a matching user_id or a session_id.
CREATE POLICY "Log own recommendation events"
  ON public.recommendation_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  );

-- Only the owning authenticated user may read their own events.
CREATE POLICY "Read own recommendation events"
  ON public.recommendation_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Personalized recommendation SQL fn: builds a "taste vector" as the mean of
-- embeddings of the user's recent positive-signal properties, then ranks the
-- approved catalog by cosine similarity. Excludes properties already seen.
CREATE OR REPLACE FUNCTION public.recommend_for_user(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL,
  match_count INT DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  town TEXT,
  county_code TEXT,
  category TEXT,
  description TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  taste vector(3072);
  seen UUID[];
BEGIN
  SELECT array_agg(DISTINCT re.property_id) INTO seen
  FROM recommendation_events re
  WHERE (p_user_id IS NOT NULL AND re.user_id = p_user_id)
     OR (p_user_id IS NULL AND p_session_id IS NOT NULL AND re.session_id = p_session_id);

  SELECT AVG(mp.embedding)::vector(3072) INTO taste
  FROM recommendation_events re
  JOIN marketplace_properties mp ON mp.id = re.property_id
  WHERE mp.embedding IS NOT NULL
    AND re.event_type IN ('click','save','book')
    AND (
      (p_user_id IS NOT NULL AND re.user_id = p_user_id)
      OR (p_user_id IS NULL AND p_session_id IS NOT NULL AND re.session_id = p_session_id)
    )
    AND re.created_at > now() - interval '90 days';

  IF taste IS NULL THEN
    -- Cold start: return trending approved properties by recent view count.
    RETURN QUERY
    SELECT mp.id, mp.name, mp.slug, mp.town, mp.county_code, mp.category::text, mp.description, 0.0::float AS similarity
    FROM marketplace_properties mp
    LEFT JOIN (
      SELECT property_id, COUNT(*) AS c
      FROM recommendation_events
      WHERE created_at > now() - interval '14 days'
      GROUP BY property_id
    ) t ON t.property_id = mp.id
    WHERE mp.status = 'approved'
      AND (seen IS NULL OR NOT (mp.id = ANY(seen)))
    ORDER BY COALESCE(t.c, 0) DESC, mp.created_at DESC
    LIMIT match_count;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    mp.id, mp.name, mp.slug, mp.town, mp.county_code, mp.category::text, mp.description,
    (1 - (mp.embedding::halfvec(3072) <=> taste::halfvec(3072)))::float AS similarity
  FROM marketplace_properties mp
  WHERE mp.status = 'approved'
    AND mp.embedding IS NOT NULL
    AND (seen IS NULL OR NOT (mp.id = ANY(seen)))
  ORDER BY mp.embedding::halfvec(3072) <=> taste::halfvec(3072)
  LIMIT match_count;
END;
$$;

-- Similar-property SQL fn: cosine similarity to a single seed property.
CREATE OR REPLACE FUNCTION public.similar_properties(
  p_property_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  town TEXT,
  county_code TEXT,
  category TEXT,
  description TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  seed vector(3072);
BEGIN
  SELECT embedding INTO seed FROM marketplace_properties WHERE id = p_property_id;
  IF seed IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    mp.id, mp.name, mp.slug, mp.town, mp.county_code, mp.category::text, mp.description,
    (1 - (mp.embedding::halfvec(3072) <=> seed::halfvec(3072)))::float AS similarity
  FROM marketplace_properties mp
  WHERE mp.status = 'approved'
    AND mp.embedding IS NOT NULL
    AND mp.id <> p_property_id
  ORDER BY mp.embedding::halfvec(3072) <=> seed::halfvec(3072)
  LIMIT match_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recommend_for_user(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recommend_for_user(UUID, TEXT, INT) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.similar_properties(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.similar_properties(UUID, INT) TO anon, authenticated, service_role;
