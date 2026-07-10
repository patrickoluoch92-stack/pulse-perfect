
CREATE TABLE public.image_ai_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.marketplace_property_images(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  labels TEXT[] NOT NULL DEFAULT '{}',
  room_type TEXT NULL,
  quality_score NUMERIC NULL,
  safety_flags TEXT[] NOT NULL DEFAULT '{}',
  dominant_colors TEXT[] NOT NULL DEFAULT '{}',
  caption TEXT NULL,
  model_version TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (image_id)
);

CREATE INDEX image_ai_tags_property_idx ON public.image_ai_tags (property_id);
CREATE INDEX image_ai_tags_room_idx ON public.image_ai_tags (room_type);

GRANT SELECT ON public.image_ai_tags TO anon, authenticated;
GRANT ALL ON public.image_ai_tags TO service_role;

ALTER TABLE public.image_ai_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read image AI tags for approved listings"
  ON public.image_ai_tags FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_properties mp
      WHERE mp.id = image_ai_tags.property_id AND mp.status = 'approved'
    )
  );

CREATE TABLE public.review_ai_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.marketplace_property_reviews(id) ON DELETE CASCADE,
  sentiment NUMERIC NOT NULL DEFAULT 0,
  aspects JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NULL,
  model_version TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);

CREATE INDEX review_ai_analysis_review_idx ON public.review_ai_analysis (review_id);

GRANT SELECT ON public.review_ai_analysis TO anon, authenticated;
GRANT ALL ON public.review_ai_analysis TO service_role;

ALTER TABLE public.review_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read review AI analysis"
  ON public.review_ai_analysis FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_property_reviews r
      WHERE r.id = review_ai_analysis.review_id
    )
  );

ALTER TABLE public.marketplace_property_reviews
  ADD COLUMN IF NOT EXISTS sentiment NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS aspects JSONB NULL;
