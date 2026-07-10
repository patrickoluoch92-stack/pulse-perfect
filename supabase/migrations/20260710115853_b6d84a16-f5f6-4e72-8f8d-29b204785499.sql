DROP POLICY IF EXISTS bookings_owner_or_admin_update ON public.marketplace_bookings;

CREATE POLICY bookings_owner_or_admin_update ON public.marketplace_bookings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM marketplace_properties p
    JOIN organization_members m ON m.org_id = p.org_id
    WHERE p.id = marketplace_bookings.property_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM marketplace_properties p
    JOIN organization_members m ON m.org_id = p.org_id
    WHERE p.id = marketplace_bookings.property_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  )
);