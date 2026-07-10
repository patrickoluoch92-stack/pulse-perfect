DROP POLICY IF EXISTS bookings_guest_read ON public.marketplace_bookings;
CREATE POLICY bookings_guest_read ON public.marketplace_bookings
FOR SELECT TO authenticated
USING (
  auth.uid() = guest_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.marketplace_properties p
    JOIN public.organization_members m ON m.org_id = p.org_id
    WHERE p.id = marketplace_bookings.property_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin','manager')
  )
);