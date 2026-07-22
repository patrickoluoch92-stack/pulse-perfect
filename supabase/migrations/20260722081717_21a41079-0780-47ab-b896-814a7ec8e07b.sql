
-- ============================================================
-- 1. Sanitized public view for discovered_properties
--    Switch to security_definer so it works after we removed the
--    permissive public SELECT policy on the base table.
-- ============================================================
DROP VIEW IF EXISTS public.public_discovered_properties;
CREATE VIEW public.public_discovered_properties
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  id,
  slug,
  status,
  name,
  property_type,
  county_code,
  town,
  ward,
  address,
  latitude,
  longitude,
  website,
  amenities,
  tags,
  keywords,
  ai_description,
  quality_score,
  created_at,
  updated_at
FROM public.discovered_properties
WHERE status IN ('pending', 'approved', 'claimed');

REVOKE ALL ON public.public_discovered_properties FROM PUBLIC;
GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;

-- Belt-and-braces: ensure anon/authenticated cannot select PII columns
-- from the base table directly.
REVOKE SELECT ON public.discovered_properties FROM anon, authenticated, PUBLIC;

-- ============================================================
-- 2. Sanitized public view for external_listings (partner feed)
-- ============================================================
DROP VIEW IF EXISTS public.public_external_listings;
CREATE VIEW public.public_external_listings
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  id,
  provider,
  external_id,
  name,
  town,
  county_code,
  country_code,
  image_url,
  price_per_night,
  currency,
  rating,
  review_count,
  deeplink_url,
  latitude,
  longitude,
  last_synced_at
FROM public.external_listings;

REVOKE ALL ON public.public_external_listings FROM PUBLIC;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;

-- Drop the broad public SELECT policy on the base table and
-- remove table-level select from public roles. Server code that
-- needs full rows (admin) already uses supabaseAdmin.
DROP POLICY IF EXISTS "Anyone can read partner listings" ON public.external_listings;
REVOKE SELECT ON public.external_listings FROM anon, authenticated, PUBLIC;
