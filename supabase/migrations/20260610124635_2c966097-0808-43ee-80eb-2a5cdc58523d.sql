-- Lock down SECURITY DEFINER functions: revoke PUBLIC, grant only what's needed.
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tour_set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;

-- Performance: indexes for hot multi-tenant query paths.
CREATE INDEX IF NOT EXISTS idx_properties_org_id ON public.properties(org_id);
CREATE INDEX IF NOT EXISTS idx_units_org_id ON public.units(org_id);
CREATE INDEX IF NOT EXISTS idx_reservations_org_id_check_in ON public.reservations(org_id, check_in);
CREATE INDEX IF NOT EXISTS idx_reservations_unit_id ON public.reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id_created ON public.invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_unit_id ON public.calendar_blocks(unit_id);
CREATE INDEX IF NOT EXISTS idx_ical_incidents_org_id_created ON public.ical_incidents(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_org_id_created ON public.app_errors(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_correlation_id ON public.app_errors(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup ON public.rate_limit_events(bucket, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_org_id ON public.tour_bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_tour_departures_package_id ON public.tour_departures(package_id);
