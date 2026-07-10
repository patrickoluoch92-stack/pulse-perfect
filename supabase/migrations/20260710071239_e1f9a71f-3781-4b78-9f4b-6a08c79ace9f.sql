
-- discovery_image_hashes
DROP POLICY IF EXISTS "Admins manage image hashes" ON public.discovery_image_hashes;
CREATE POLICY "Admins manage image hashes" ON public.discovery_image_hashes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- guest_wishlists
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.guest_wishlists;
CREATE POLICY "Users manage own wishlist" ON public.guest_wishlists
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- loyalty_accounts
DROP POLICY IF EXISTS "Users view own loyalty" ON public.loyalty_accounts;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- loyalty_ledger
DROP POLICY IF EXISTS "Users view own ledger" ON public.loyalty_ledger;
CREATE POLICY "Users view own ledger" ON public.loyalty_ledger
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- pricing_signals
DROP POLICY IF EXISTS "Admins manage pricing signals" ON public.pricing_signals;
CREATE POLICY "Admins manage pricing signals" ON public.pricing_signals
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Org members read own pricing signals" ON public.pricing_signals;
CREATE POLICY "Org members read own pricing signals" ON public.pricing_signals
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

-- Reassert revocation of sensitive PII columns on discovered_properties
REVOKE SELECT (phone, email, whatsapp) ON public.discovered_properties FROM anon, authenticated;
