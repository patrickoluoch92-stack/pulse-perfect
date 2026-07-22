
-- Restrict public exposure on discovered_properties: drop the broad public SELECT policy.
-- Public reads happen through the sanitized `public_discovered_properties` view; admins
-- read via service_role (supabaseAdmin).
DROP POLICY IF EXISTS "Public visible discovered rows" ON public.discovered_properties;

-- Restrict external_listings raw jsonb column from anon/authenticated readers.
REVOKE SELECT (raw) ON public.external_listings FROM anon, authenticated, PUBLIC;
