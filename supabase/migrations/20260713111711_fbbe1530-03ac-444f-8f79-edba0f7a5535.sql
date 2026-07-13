
-- 1) Revoke EXECUTE on sensitive SECURITY DEFINER functions from PUBLIC/anon/authenticated.
--    Keep service_role and specific callers only.
DO $$
DECLARE
  fn_name text;
BEGIN
  FOR fn_name IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'accept_organization_invitation_for',
        'next_invoice_number',
        'ensure_owner_wallet',
        'handle_new_user',
        'mkt_guard_status_change',
        'knowledge_facts_version_bump'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_name);
  END LOOP;
END $$;

-- Keep helper checks callable by authenticated (used by RLS policies)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) TO authenticated, service_role;
-- accept_organization_invitation_for must be callable by authenticated to accept invitations
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) TO authenticated;
-- next_invoice_number is called from authenticated server fn
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) TO authenticated;

-- 2) Re-assert column-level REVOKE on external_listings.raw for anon/authenticated
REVOKE SELECT (raw) ON public.external_listings FROM anon, authenticated;

-- 3) commission_rules: ensure clean policy set (admin ALL + authenticated SELECT).
--    Drop any redundant admin read-only policy if it exists.
DROP POLICY IF EXISTS "commission_rules admin read" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rules_admin_read" ON public.commission_rules;
