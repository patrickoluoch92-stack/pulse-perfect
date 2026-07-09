
-- 1) Coupons: remove public enumeration of active codes
DROP POLICY IF EXISTS "coupons public read active" ON public.coupons;

-- 2) Discovered properties: stop exposing raw table (with phone/email/whatsapp) to anon/auth
DROP POLICY IF EXISTS "Anon can read visible discovered rows" ON public.discovered_properties;
DROP POLICY IF EXISTS "Discovered visible statuses readable by everyone" ON public.discovered_properties;

-- Make public view SECURITY DEFINER so it can serve safe columns without base-table SELECT
ALTER VIEW public.public_discovered_properties SET (security_invoker = false);
GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from signed-in users
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(text) TO service_role;

-- Server-side variant of accept_invitation that takes user_id explicitly (called via service_role)
CREATE OR REPLACE FUNCTION public.accept_organization_invitation_for(_token text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv public.organization_invitations%ROWTYPE;
  user_email TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = _user_id;
  SELECT * INTO inv FROM public.organization_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email';
  END IF;
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (inv.org_id, _user_id, inv.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.organization_invitations
    SET accepted_at = now(), accepted_by = _user_id
    WHERE id = inv.id;
  RETURN inv.org_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) TO service_role;
