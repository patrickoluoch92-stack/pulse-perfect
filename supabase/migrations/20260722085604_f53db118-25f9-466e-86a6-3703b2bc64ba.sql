
-- Switch sanitized views to run as owner (postgres) so public reads via the view continue to work
-- after removing the base-table anon/authenticated policies.
ALTER VIEW public.public_discovered_properties SET (security_invoker = false, security_barrier = true);
ALTER VIEW public.public_external_listings SET (security_invoker = false, security_barrier = true);

GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;

-- Drop the overly permissive base-table SELECT policies. Public consumers must use the sanitized views.
DROP POLICY IF EXISTS "Public visible discovered rows" ON public.discovered_properties;
DROP POLICY IF EXISTS "Public partner listings readable" ON public.external_listings;

-- Base tables: revoke any residual anon/authenticated SELECT so PII columns are unreachable directly.
REVOKE SELECT ON public.discovered_properties FROM anon, authenticated;
REVOKE SELECT ON public.external_listings FROM anon, authenticated;
GRANT ALL ON public.discovered_properties TO service_role;
GRANT ALL ON public.external_listings TO service_role;
