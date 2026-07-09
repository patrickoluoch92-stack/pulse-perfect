
-- 1. Taxonomy table (parent/child hierarchy, unlimited depth via self-fk)
CREATE TABLE IF NOT EXISTS public.property_category_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.property_category_nodes(id) ON DELETE CASCADE,
  legacy_category TEXT, -- links to old PROPERTY_CATEGORIES.value when applicable
  description TEXT,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.property_category_nodes TO anon, authenticated;
GRANT ALL ON public.property_category_nodes TO service_role;

ALTER TABLE public.property_category_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active category nodes"
  ON public.property_category_nodes FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage category nodes"
  ON public.property_category_nodes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pcn_parent ON public.property_category_nodes(parent_id);
CREATE INDEX idx_pcn_legacy ON public.property_category_nodes(legacy_category);

CREATE TRIGGER pcn_set_updated_at
  BEFORE UPDATE ON public.property_category_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add hierarchy slugs to marketplace_properties for filter/SEO
ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS parent_category_slug TEXT,
  ADD COLUMN IF NOT EXISTS child_category_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_mp_parent_slug ON public.marketplace_properties(parent_category_slug);
CREATE INDEX IF NOT EXISTS idx_mp_child_slug ON public.marketplace_properties(child_category_slug);

-- 3. Seed the parent + children
INSERT INTO public.property_category_nodes (slug, name, parent_id, display_order, description, seo_title, seo_description)
VALUES ('commercial-rental-houses', 'Commercial / Rental Houses', NULL, 10,
  'Residential and commercial rental properties across Kenya.',
  'Rental Houses & Commercial Properties in Kenya',
  'Browse rental houses, apartments, bedsitters, office spaces, and more across Kenya.')
ON CONFLICT (slug) DO NOTHING;

-- Children mapped to legacy categories
WITH parent AS (SELECT id FROM public.property_category_nodes WHERE slug = 'commercial-rental-houses')
INSERT INTO public.property_category_nodes (slug, name, parent_id, legacy_category, display_order)
SELECT v.slug, v.name, parent.id, v.legacy_category, v.ord
FROM parent,
  (VALUES
    ('single-room', 'Single Room', 'single_room', 10),
    ('bedsitter', 'Bedsitter', 'bedsitter', 20),
    ('studio', 'Studio', 'studio', 30),
    ('1-bedroom', '1 Bedroom', 'one_bedroom', 40),
    ('2-bedroom', '2 Bedroom', 'two_bedroom', 50),
    ('3-bedroom', '3 Bedroom', 'three_bedroom', 60),
    ('4-bedroom', '4 Bedroom', 'four_bedroom', 70),
    ('apartment', 'Apartment', 'apartment', 80),
    ('flats', 'Flats', 'flat', 90),
    ('maisonette', 'Maisonette', 'maisonette', 100),
    ('townhouse', 'Townhouse', 'townhouse', 110),
    ('stand-alone-house', 'Stand-alone House', 'standalone_house', 120),
    ('bungalow', 'Bungalow', 'bungalow', 130),
    ('duplex', 'Duplex', 'duplex', 140),
    ('penthouse', 'Penthouse', 'penthouse', 150),
    ('gated-community-home', 'Gated Community Home', 'gated_community_home', 160),
    ('cottage', 'Cottage', 'cottage', 170),
    ('student-hostel', 'Student Hostel', 'student_hostel', 180),
    ('staff-housing', 'Staff Housing', 'staff_housing', 190),
    ('senior-living', 'Senior Living', 'senior_living', 200),
    ('office-spaces', 'Office Spaces', 'office_space', 210)
  ) AS v(slug, name, legacy_category, ord)
ON CONFLICT (slug) DO NOTHING;

-- 4. Backfill parent/child slugs on existing listings
UPDATE public.marketplace_properties mp
SET parent_category_slug = p.slug,
    child_category_slug  = c.slug
FROM public.property_category_nodes c
JOIN public.property_category_nodes p ON p.id = c.parent_id
WHERE c.legacy_category = mp.category::text
  AND mp.parent_category_slug IS NULL;
