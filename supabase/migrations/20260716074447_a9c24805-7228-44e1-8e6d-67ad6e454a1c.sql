REVOKE EXECUTE ON FUNCTION public.mobility_is_company_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mobility_is_company_admin(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) TO authenticated, service_role;
