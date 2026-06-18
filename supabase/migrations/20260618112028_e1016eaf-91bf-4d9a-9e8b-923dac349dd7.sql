REVOKE EXECUTE ON FUNCTION public.org_has_active_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(UUID) TO authenticated, service_role;