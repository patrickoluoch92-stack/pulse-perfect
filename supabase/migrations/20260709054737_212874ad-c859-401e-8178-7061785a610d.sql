
REVOKE EXECUTE ON FUNCTION public.ensure_owner_wallet() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_owner_wallet() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_owner_wallet() TO service_role;
