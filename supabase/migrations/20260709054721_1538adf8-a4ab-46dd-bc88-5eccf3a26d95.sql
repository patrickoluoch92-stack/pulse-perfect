
-- =========================================================================
-- COMMISSION RULES
-- =========================================================================
CREATE TYPE public.commission_scope AS ENUM ('global','county','category','property','org');

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope public.commission_scope NOT NULL DEFAULT 'global',
  scope_value text,
  rate_percent numeric(6,3) NOT NULL DEFAULT 10.000,
  flat_amount numeric(12,2) NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CHECK (flat_amount >= 0)
);
CREATE INDEX idx_commission_rules_lookup ON public.commission_rules (active, scope, scope_value, priority DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_rules admin manage" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "commission_rules authenticated read" ON public.commission_rules
  FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER trg_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Default 10% global rule
INSERT INTO public.commission_rules (name, scope, rate_percent, priority, notes)
VALUES ('Default platform commission','global',10.000,100,'Applied when no more specific rule matches.');

-- =========================================================================
-- TAX RATES
-- =========================================================================
CREATE TABLE public.platform_tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  rate_percent numeric(6,3) NOT NULL DEFAULT 0,
  applies_to text[] NOT NULL DEFAULT ARRAY['booking']::text[],
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rate_percent >= 0 AND rate_percent <= 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_tax_rates TO authenticated;
GRANT ALL ON public.platform_tax_rates TO service_role;
GRANT SELECT ON public.platform_tax_rates TO anon;
ALTER TABLE public.platform_tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_rates public read active" ON public.platform_tax_rates
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "tax_rates admin manage" ON public.platform_tax_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tax_rates_updated_at
  BEFORE UPDATE ON public.platform_tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_tax_rates (code,name,rate_percent,applies_to,notes) VALUES
 ('vat','Value Added Tax (Kenya)',16.000, ARRAY['booking','invoice','subscription'], 'KRA VAT applied to platform fees.'),
 ('tourism_levy','Tourism Levy',2.000, ARRAY['booking'], 'Kenya Tourism Levy on eligible accommodation.'),
 ('service_fee','Platform Service Fee',0.000, ARRAY['booking'], 'Optional service fee on top of commission.');

-- =========================================================================
-- OWNER WALLETS
-- =========================================================================
CREATE TABLE public.owner_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'KES',
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  pending_balance numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_earned numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_paid_out numeric(14,2) NOT NULL DEFAULT 0,
  payout_method text NOT NULL DEFAULT 'mpesa',
  payout_destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_wallets TO authenticated;
GRANT ALL ON public.owner_wallets TO service_role;
ALTER TABLE public.owner_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets member read" ON public.owner_wallets
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wallets owner update destination" ON public.owner_wallets
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wallets admin manage" ON public.owner_wallets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.owner_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- WALLET LEDGER (append-only)
-- =========================================================================
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.owner_wallets(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('credit','debit')),
  category text NOT NULL CHECK (category IN ('booking_earnings','commission','payout','refund','adjustment','fee','bonus')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  available_after numeric(14,2) NOT NULL,
  pending_after numeric(14,2) NOT NULL,
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_wallet ON public.wallet_ledger (wallet_id, created_at DESC);
CREATE INDEX idx_ledger_org ON public.wallet_ledger (org_id, created_at DESC);
CREATE INDEX idx_ledger_reference ON public.wallet_ledger (reference_type, reference_id);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger member read" ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- PAYOUTS
-- =========================================================================
CREATE TYPE public.payout_status AS ENUM ('requested','approved','processing','paid','failed','cancelled');

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.owner_wallets(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'KES',
  method text NOT NULL DEFAULT 'mpesa' CHECK (method IN ('mpesa','bank','manual')),
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.payout_status NOT NULL DEFAULT 'requested',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  processed_at timestamptz,
  external_reference text,
  failure_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_org ON public.payouts (org_id, created_at DESC);
CREATE INDEX idx_payouts_status ON public.payouts (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts member read" ON public.payouts
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "payouts owner request" ON public.payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]));
CREATE POLICY "payouts admin manage" ON public.payouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- BOOKING COMMISSIONS
-- =========================================================================
CREATE TABLE public.booking_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_bookings(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  gross_amount numeric(14,2) NOT NULL,
  commission_rate numeric(6,3) NOT NULL,
  commission_amount numeric(14,2) NOT NULL,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  levy_amount numeric(14,2) NOT NULL DEFAULT 0,
  service_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_owner_amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','reversed','cancelled')),
  credited_ledger_id uuid REFERENCES public.wallet_ledger(id) ON DELETE SET NULL,
  settled_ledger_id uuid REFERENCES public.wallet_ledger(id) ON DELETE SET NULL,
  reversed_ledger_id uuid REFERENCES public.wallet_ledger(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_commissions_org ON public.booking_commissions (org_id, created_at DESC);
CREATE INDEX idx_booking_commissions_status ON public.booking_commissions (status);
GRANT SELECT ON public.booking_commissions TO authenticated;
GRANT ALL ON public.booking_commissions TO service_role;
ALTER TABLE public.booking_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_commissions member read" ON public.booking_commissions
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_booking_commissions_updated_at
  BEFORE UPDATE ON public.booking_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Auto-create wallet when an organization is created
-- =========================================================================
CREATE OR REPLACE FUNCTION public.ensure_owner_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.owner_wallets (org_id) VALUES (NEW.id)
    ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_org_ensure_wallet
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_wallet();

-- Backfill wallets for existing orgs
INSERT INTO public.owner_wallets (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;
