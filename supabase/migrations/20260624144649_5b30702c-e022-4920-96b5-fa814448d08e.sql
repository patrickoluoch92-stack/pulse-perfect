-- Revoke anon access to PII columns on marketplace_properties.
-- RLS still permits SELECT on approved rows, but PostgREST will omit
-- contact columns for anonymous callers.
REVOKE SELECT (contact_email, contact_phone, contact_whatsapp)
  ON public.marketplace_properties FROM anon;

-- Ensure authenticated and service roles retain full column access.
GRANT SELECT ON public.marketplace_properties TO authenticated;
GRANT ALL ON public.marketplace_properties TO service_role;