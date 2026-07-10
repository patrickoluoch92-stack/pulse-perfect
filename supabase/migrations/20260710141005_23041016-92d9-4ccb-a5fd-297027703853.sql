
-- 1. Guests: restrict SELECT to manager+ roles (PII protection)
DROP POLICY IF EXISTS "Members read guests" ON public.guests;
CREATE POLICY "Managers read guests" ON public.guests
  FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

-- 2. rate_limit_events: revoke client write privileges (service_role only)
REVOKE INSERT, UPDATE, DELETE ON public.rate_limit_events FROM anon, authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;

-- 3. units.ical_export_token: restrict column-level SELECT to owner/admin only
REVOKE SELECT (ical_export_token) ON public.units FROM authenticated, anon;
GRANT SELECT (ical_export_token) ON public.units TO service_role;

-- 4. marketplace_availability_blocks.reason: hide from anonymous public reads
REVOKE SELECT (reason) ON public.marketplace_availability_blocks FROM anon;
