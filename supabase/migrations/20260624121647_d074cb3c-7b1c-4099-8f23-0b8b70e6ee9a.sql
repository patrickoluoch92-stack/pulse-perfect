
-- Revoke broad EXECUTE from PUBLIC and anon on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated retains access to RPC + RLS helpers it legitimately needs
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
