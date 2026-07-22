
-- Revert views to security_invoker so linter is happy; views rely on base-table RLS + column grants.
ALTER VIEW public.public_discovered_properties SET (security_invoker = true, security_barrier = true);
ALTER VIEW public.public_external_listings SET (security_invoker = true, security_barrier = true);

GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;

-- Base table SELECT: column-level grants only on safe (non-PII) columns.
-- discovered_properties: exclude phone, email, whatsapp.
GRANT SELECT (
  id, status, source_id, source_url, slug, name, property_type, county_code, town, ward,
  address, latitude, longitude, website, socials, amenities, tags, keywords,
  ai_description, ai_confidence, quality_score, dedupe_fingerprint, merged_into,
  promoted_property_id, rejection_reason, reviewed_at, reviewed_by, created_at, updated_at
) ON public.discovered_properties TO anon, authenticated;

-- external_listings: exclude raw jsonb payload.
GRANT SELECT (
  id, provider, external_id, name, town, county_code, country_code, latitude, longitude,
  image_url, price_per_night, currency, rating, review_count, deeplink_url,
  last_synced_at, created_at, updated_at
) ON public.external_listings TO anon, authenticated;

-- Row-visibility policies scoped to public-safe statuses.
CREATE POLICY "Public visible discovered rows (safe cols)" ON public.discovered_properties
  FOR SELECT TO anon, authenticated
  USING (status = ANY (ARRAY['pending','approved','claimed']));

CREATE POLICY "Public partner listings readable (safe cols)" ON public.external_listings
  FOR SELECT TO anon, authenticated
  USING (true);
