
-- Recreate the sanitized views as security_invoker (the safe default).
-- To make them work for anon/authenticated, we grant column-level SELECT
-- on only the safe columns of the underlying tables, and add narrow RLS
-- SELECT policies that limit which rows are visible.

-- ============================================================
-- discovered_properties
-- ============================================================
DROP VIEW IF EXISTS public.public_discovered_properties;

GRANT SELECT (
  id, slug, status, name, property_type,
  county_code, town, ward, address,
  latitude, longitude, website,
  amenities, tags, keywords,
  ai_description, quality_score,
  created_at, updated_at
) ON public.discovered_properties TO anon, authenticated;

-- Row filter: public can only see live directory rows, never PII-heavy
-- rejected/archived/merged rows.
DROP POLICY IF EXISTS "Public visible discovered rows" ON public.discovered_properties;
CREATE POLICY "Public visible discovered rows"
  ON public.discovered_properties
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('pending', 'approved', 'claimed'));

CREATE VIEW public.public_discovered_properties
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, slug, status, name, property_type,
  county_code, town, ward, address,
  latitude, longitude, website,
  amenities, tags, keywords,
  ai_description, quality_score,
  created_at, updated_at
FROM public.discovered_properties
WHERE status IN ('pending', 'approved', 'claimed');

GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;

-- ============================================================
-- external_listings
-- ============================================================
DROP VIEW IF EXISTS public.public_external_listings;

GRANT SELECT (
  id, provider, external_id, name,
  town, county_code, country_code,
  image_url, price_per_night, currency,
  rating, review_count, deeplink_url,
  latitude, longitude, last_synced_at
) ON public.external_listings TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read partner listings" ON public.external_listings;
CREATE POLICY "Public partner listings readable"
  ON public.external_listings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE VIEW public.public_external_listings
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, provider, external_id, name,
  town, county_code, country_code,
  image_url, price_per_night, currency,
  rating, review_count, deeplink_url,
  latitude, longitude, last_synced_at
FROM public.external_listings;

GRANT SELECT ON public.public_external_listings TO anon, authenticated;
