
-- =====================================================================
-- 1. SECURITY DEFINER function exposure
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant only the helpers that authenticated code and RLS policies rely on.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation_for(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) TO authenticated;

-- Ensure service_role retains full function access for admin server code.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================================
-- 2. mobility_bookings — restrictive WITH CHECK on update
-- =====================================================================
DROP POLICY IF EXISTS "bookings_org_update" ON public.mobility_bookings;
CREATE POLICY "bookings_org_update" ON public.mobility_bookings
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = mobility_bookings.org_id
        AND m.user_id = auth.uid()
        AND m.role = ANY (ARRAY['owner'::public.org_role, 'enterprise_admin'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = mobility_bookings.org_id
        AND m.user_id = auth.uid()
        AND m.role = ANY (ARRAY['owner'::public.org_role, 'enterprise_admin'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])
    )
  );

-- =====================================================================
-- 3. mobility-media bucket — restrict public read to approved assets
-- =====================================================================
DROP POLICY IF EXISTS "mobility-media public read" ON storage.objects;

CREATE POLICY "mobility-media approved public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'mobility-media' AND (
      EXISTS (
        SELECT 1
        FROM public.mobility_vehicle_images vi
        JOIN public.mobility_vehicles v ON v.id = vi.vehicle_id
        WHERE v.status = 'approved'::public.mobility_status
          AND vi.url LIKE '%' || storage.objects.name
      )
      OR EXISTS (
        SELECT 1
        FROM public.mobility_providers p
        WHERE p.verification_status = 'approved'::public.mobility_status
          AND p.cover_image_url LIKE '%' || storage.objects.name
      )
    )
  );

CREATE POLICY "mobility-media org member read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mobility-media'
    AND public.is_org_member(
      auth.uid(),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  );

-- =====================================================================
-- 4. Re-assert column-level revokes on sensitive fields
-- =====================================================================
REVOKE SELECT (email, phone, whatsapp)
  ON public.discovered_properties FROM anon, authenticated;

REVOKE SELECT (raw)
  ON public.external_listings FROM anon, authenticated;
