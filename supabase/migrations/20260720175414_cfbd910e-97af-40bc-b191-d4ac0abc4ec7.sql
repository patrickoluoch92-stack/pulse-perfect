-- Restrict public exposure of sensitive columns in discovered_properties and external_listings.
-- The RLS policies remain permissive for the safe display columns; column-level REVOKEs
-- prevent anon/authenticated PostgREST clients from selecting the PII/raw fields even when
-- the row itself is visible. Server-side code uses supabaseAdmin (service_role) which
-- bypasses column privileges, so admin dashboards and back-office jobs are unaffected.

REVOKE SELECT (phone, email, whatsapp) ON public.discovered_properties FROM anon, authenticated;
REVOKE SELECT (raw) ON public.external_listings FROM anon, authenticated;