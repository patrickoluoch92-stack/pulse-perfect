
-- Drop permissive public SELECT policies exposing PII/raw columns
DROP POLICY IF EXISTS "Public visible discovered rows (safe cols)" ON public.discovered_properties;
DROP POLICY IF EXISTS "Public partner listings readable (safe cols)" ON public.external_listings;

-- Revoke table-level SELECT so no columns are reachable directly by anon/authenticated
REVOKE SELECT ON public.discovered_properties FROM anon, authenticated;
REVOKE SELECT ON public.external_listings FROM anon, authenticated;

-- Sanitized views (created previously) remain the sole public read path
GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
