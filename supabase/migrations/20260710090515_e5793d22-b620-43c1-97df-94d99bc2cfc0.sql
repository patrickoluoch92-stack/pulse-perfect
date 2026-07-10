
REVOKE SELECT (email, phone, whatsapp) ON public.discovered_properties FROM anon, authenticated, PUBLIC;
REVOKE SELECT (raw) ON public.external_listings FROM anon, authenticated, PUBLIC;
