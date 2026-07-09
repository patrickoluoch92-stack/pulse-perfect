
-- Restore security_invoker to avoid the "Security Definer View" linter warning
ALTER VIEW public.public_discovered_properties SET (security_invoker = true);

-- Re-add row-level access limited to visible statuses (RLS)
CREATE POLICY "Public visible discovered rows"
ON public.discovered_properties
FOR SELECT
TO anon, authenticated
USING (status = ANY (ARRAY['pending'::text, 'approved'::text, 'claimed'::text]));

-- Column-level GRANT: hide phone, email, whatsapp, and other private/moderation fields.
REVOKE SELECT ON public.discovered_properties FROM anon, authenticated;
GRANT SELECT (
  id, slug, status, name, property_type, county_code, town, ward, address,
  latitude, longitude, website, amenities, tags, keywords, ai_description,
  quality_score, created_at, updated_at
) ON public.discovered_properties TO anon, authenticated;
