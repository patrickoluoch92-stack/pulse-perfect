
-- Guest wishlist
CREATE TABLE public.guest_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
GRANT SELECT, INSERT, DELETE ON public.guest_wishlists TO authenticated;
GRANT ALL ON public.guest_wishlists TO service_role;
ALTER TABLE public.guest_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.guest_wishlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Loyalty accounts (points ledger)
CREATE TABLE public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  lifetime_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger" ON public.loyalty_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Discovery image fingerprints (perceptual-hash dedupe)
CREATE TABLE public.discovery_image_hashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_property_id uuid REFERENCES public.discovered_properties(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  phash text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dih_phash ON public.discovery_image_hashes(phash);
CREATE INDEX idx_dih_property ON public.discovery_image_hashes(property_id);
CREATE INDEX idx_dih_discovered ON public.discovery_image_hashes(discovered_property_id);
GRANT SELECT ON public.discovery_image_hashes TO authenticated;
GRANT ALL ON public.discovery_image_hashes TO service_role;
ALTER TABLE public.discovery_image_hashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage image hashes" ON public.discovery_image_hashes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pricing signals (competitor rates + events)
CREATE TABLE public.pricing_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('competitor_rate','event','holiday','weather','demand_spike')),
  region_code text,
  observed_on date NOT NULL,
  valid_until date,
  price_amount numeric(12,2),
  currency text DEFAULT 'KES',
  weight numeric(4,3) NOT NULL DEFAULT 1.0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_signals_lookup ON public.pricing_signals(property_id, signal_type, observed_on);
CREATE INDEX idx_pricing_signals_region ON public.pricing_signals(region_code, observed_on);
GRANT SELECT ON public.pricing_signals TO authenticated;
GRANT ALL ON public.pricing_signals TO service_role;
ALTER TABLE public.pricing_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read own pricing signals" ON public.pricing_signals
  FOR SELECT USING (
    org_id IS NULL OR public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins manage pricing signals" ON public.pricing_signals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for loyalty_accounts.updated_at
CREATE TRIGGER trg_loyalty_accounts_updated_at BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
