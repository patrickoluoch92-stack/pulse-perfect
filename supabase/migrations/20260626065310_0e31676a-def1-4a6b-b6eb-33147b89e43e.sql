
-- 1. Marketplace contact PII: remove anon read access on sensitive contact columns
REVOKE SELECT (contact_email, contact_phone, contact_whatsapp)
  ON public.marketplace_properties FROM anon;

-- 2. Organization invitations: restrict reads to owners/admins (acceptance flow uses SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Members view invitations" ON public.organization_invitations;

-- 3. organization_members: require a valid invitation for self-insert
DROP POLICY IF EXISTS "Self-insert or admin add member" ON public.organization_members;

CREATE POLICY "Insert via invite or admin"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role])
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.organization_invitations i
      JOIN auth.users u ON u.id = auth.uid()
      WHERE i.org_id = organization_members.org_id
        AND lower(i.email) = lower(u.email)
        AND i.role = organization_members.role
        AND i.accepted_at IS NULL
        AND i.expires_at > now()
    )
  )
);

-- 4. units: restrict full-row reads (including ical_export_token) to manager+
DROP POLICY IF EXISTS "Members read units" ON public.units;

CREATE POLICY "Managers read units"
ON public.units FOR SELECT TO authenticated
USING (
  public.has_org_role(
    auth.uid(),
    org_id,
    ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]
  )
);

-- 5. SECURITY DEFINER helpers: revoke direct EXECUTE from signed-in users.
--    These remain callable inside RLS policy evaluation (which runs as the
--    table owner) but can no longer be invoked directly via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) FROM authenticated, anon, PUBLIC;
