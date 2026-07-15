
-- =========================================================================
-- MOBILITY BATCH 1: schema, RLS, GRANTs, RBAC seed
-- =========================================================================

-- ---------- ENUMS ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.mobility_owner_type AS ENUM ('company','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mobility_submission_status AS ENUM ('pending','approved','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mobility_doc_type AS ENUM (
    'insurance','inspection','logbook','roadworthiness','service_history','compliance','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mobility_maintenance_status AS ENUM ('scheduled','in_progress','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mobility_pricing_tier AS ENUM (
    'daily','weekend','weekly','monthly','lease','corporate','holiday','peak','promo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- PROVIDER EXTENSIONS ------------------------------------------
ALTER TABLE public.mobility_providers
  ADD COLUMN IF NOT EXISTS years_in_business INT,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS social JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS accepts_private_vehicles BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_owner_commission_pct NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS private_owner_quality_min INT DEFAULT 60;

-- ---------- BRANCHES ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.mobility_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  county_code TEXT,
  town TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  contact_phone TEXT,
  contact_email TEXT,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobility_branches_provider ON public.mobility_branches(provider_id);
CREATE INDEX IF NOT EXISTS idx_mobility_branches_org ON public.mobility_branches(org_id);
GRANT SELECT ON public.mobility_branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_branches TO authenticated;
GRANT ALL ON public.mobility_branches TO service_role;
ALTER TABLE public.mobility_branches ENABLE ROW LEVEL SECURITY;
REVOKE SELECT (contact_phone, contact_email) ON public.mobility_branches FROM anon;
CREATE POLICY "branches public read active" ON public.mobility_branches FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "branches org manage" ON public.mobility_branches FOR ALL
  TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER mobility_branches_updated_at BEFORE UPDATE ON public.mobility_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ---------- PRIVATE OWNERS -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_private_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  id_number TEXT,
  kra_pin TEXT,
  phone TEXT,
  email TEXT,
  county_code TEXT,
  town TEXT,
  address TEXT,
  bank_details JSONB DEFAULT '{}'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_private_owners TO authenticated;
GRANT ALL ON public.mobility_private_owners TO service_role;
ALTER TABLE public.mobility_private_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "priv owner self read" ON public.mobility_private_owners FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "priv owner self write" ON public.mobility_private_owners FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "priv owner admin all" ON public.mobility_private_owners FOR ALL
  TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER mobility_private_owners_updated_at BEFORE UPDATE ON public.mobility_private_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ---------- VEHICLE EXTENSIONS -------------------------------------------
ALTER TABLE public.mobility_vehicles
  ADD COLUMN IF NOT EXISTS owner_type public.mobility_owner_type NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS private_owner_id UUID REFERENCES public.mobility_private_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS body_type TEXT,
  ADD COLUMN IF NOT EXISTS drive_type_ext TEXT,
  ADD COLUMN IF NOT EXISTS fleet_no TEXT,
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS mileage_km INT,
  ADD COLUMN IF NOT EXISTS quality_score INT,
  ADD COLUMN IF NOT EXISTS ai_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instant_book BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_rental_hours INT DEFAULT 4,
  ADD COLUMN IF NOT EXISTS mileage_limit_km_per_day INT,
  ADD COLUMN IF NOT EXISTS extra_km_kes NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS insurance JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit_kes NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_kes NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS chauffeur_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_drive_available BOOLEAN NOT NULL DEFAULT true;
-- VIN sensitive: revoke from anon (public read policy exists on vehicles table)
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (vin) ON public.mobility_vehicles FROM anon';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------- SUBMISSIONS (private owner → provider) -----------------------
CREATE TABLE IF NOT EXISTS public.mobility_vehicle_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_owner_id UUID NOT NULL REFERENCES public.mobility_private_owners(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.mobility_providers(id) ON DELETE CASCADE,
  provider_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_snapshot JSONB NOT NULL,
  proposed_daily_rate_kes NUMERIC(12,2),
  commission_pct NUMERIC(5,2),
  status public.mobility_submission_status NOT NULL DEFAULT 'pending',
  approved_vehicle_id UUID REFERENCES public.mobility_vehicles(id) ON DELETE SET NULL,
  decision_reason TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mob_sub_owner ON public.mobility_vehicle_submissions(private_owner_id);
CREATE INDEX IF NOT EXISTS idx_mob_sub_provider ON public.mobility_vehicle_submissions(provider_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_vehicle_submissions TO authenticated;
GRANT ALL ON public.mobility_vehicle_submissions TO service_role;
ALTER TABLE public.mobility_vehicle_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub owner read" ON public.mobility_vehicle_submissions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mobility_private_owners po
            WHERE po.id = private_owner_id AND po.user_id = auth.uid())
    OR public.is_org_member(auth.uid(), provider_org_id)
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "sub owner insert" ON public.mobility_vehicle_submissions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.mobility_private_owners po
            WHERE po.id = private_owner_id AND po.user_id = auth.uid())
  );
CREATE POLICY "sub owner update own" ON public.mobility_vehicle_submissions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mobility_private_owners po
            WHERE po.id = private_owner_id AND po.user_id = auth.uid())
    AND status = 'pending'
  );
CREATE POLICY "sub provider decide" ON public.mobility_vehicle_submissions FOR UPDATE
  TO authenticated USING (
    public.is_org_member(auth.uid(), provider_org_id)
    OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER mobility_submissions_updated_at BEFORE UPDATE ON public.mobility_vehicle_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

ALTER TABLE public.mobility_vehicles
  ADD CONSTRAINT mobility_vehicles_submission_fk
  FOREIGN KEY (submission_id) REFERENCES public.mobility_vehicle_submissions(id) ON DELETE SET NULL
  NOT VALID;

-- ---------- VEHICLE DOCUMENTS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type public.mobility_doc_type NOT NULL,
  title TEXT,
  file_url TEXT NOT NULL,
  issued_at DATE,
  expires_at DATE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mob_docs_vehicle ON public.mobility_vehicle_documents(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_vehicle_documents TO authenticated;
GRANT ALL ON public.mobility_vehicle_documents TO service_role;
ALTER TABLE public.mobility_vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs org access" ON public.mobility_vehicle_documents FOR ALL
  TO authenticated USING (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER mobility_docs_updated_at BEFORE UPDATE ON public.mobility_vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ---------- MAINTENANCE --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  cost_kes NUMERIC(12,2),
  odometer_km INT,
  vendor TEXT,
  notes TEXT,
  status public.mobility_maintenance_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mob_maint_vehicle ON public.mobility_maintenance(vehicle_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_maintenance TO authenticated;
GRANT ALL ON public.mobility_maintenance TO service_role;
ALTER TABLE public.mobility_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maint org access" ON public.mobility_maintenance FOR ALL
  TO authenticated USING (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER mobility_maint_updated_at BEFORE UPDATE ON public.mobility_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ---------- PRICING TIERS ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier public.mobility_pricing_tier NOT NULL,
  price_kes NUMERIC(12,2) NOT NULL,
  min_units INT DEFAULT 1,
  starts_on DATE,
  ends_on DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mob_price_vehicle ON public.mobility_pricing_tiers(vehicle_id, tier);
GRANT SELECT ON public.mobility_pricing_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_pricing_tiers TO authenticated;
GRANT ALL ON public.mobility_pricing_tiers TO service_role;
ALTER TABLE public.mobility_pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing public read active" ON public.mobility_pricing_tiers FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "pricing org manage" ON public.mobility_pricing_tiers FOR ALL
  TO authenticated USING (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  ) WITH CHECK (
    public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER mobility_pricing_updated_at BEFORE UPDATE ON public.mobility_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ---------- BOOKING EXTENSIONS -------------------------------------------
ALTER TABLE public.mobility_bookings
  ADD COLUMN IF NOT EXISTS mileage_start_km INT,
  ADD COLUMN IF NOT EXISTS mileage_end_km INT,
  ADD COLUMN IF NOT EXISTS fuel_start TEXT,
  ADD COLUMN IF NOT EXISTS fuel_end TEXT,
  ADD COLUMN IF NOT EXISTS damage_report JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS chauffeur_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS extension_of UUID REFERENCES public.mobility_bookings(id) ON DELETE SET NULL;

-- ---------- RBAC PERMISSIONS SEED ----------------------------------------
INSERT INTO public.rbac_permissions (key, category, label, description) VALUES
  ('mobility.manage','mobility','Manage mobility company','Access company dashboard, branches, settings'),
  ('mobility.fleet.write','mobility','Manage fleet','Create/edit/archive vehicles, pricing, documents, maintenance'),
  ('mobility.bookings.manage','mobility','Manage vehicle bookings','Accept, decline, extend, cancel vehicle bookings'),
  ('mobility.payouts.read','mobility','Read mobility payouts','See revenue and payout statements for the company'),
  ('mobility.private_owner.review','mobility','Review private-owner submissions','Approve/reject vehicles submitted by private owners')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.rbac_role_defaults (role, permission) VALUES
  ('owner','mobility.manage'),
  ('owner','mobility.fleet.write'),
  ('owner','mobility.bookings.manage'),
  ('owner','mobility.payouts.read'),
  ('owner','mobility.private_owner.review'),
  ('enterprise_admin','mobility.manage'),
  ('enterprise_admin','mobility.fleet.write'),
  ('enterprise_admin','mobility.bookings.manage'),
  ('enterprise_admin','mobility.payouts.read'),
  ('enterprise_admin','mobility.private_owner.review'),
  ('admin','mobility.manage'),
  ('admin','mobility.fleet.write'),
  ('admin','mobility.bookings.manage'),
  ('admin','mobility.payouts.read'),
  ('admin','mobility.private_owner.review'),
  ('manager','mobility.fleet.write'),
  ('manager','mobility.bookings.manage'),
  ('staff','mobility.bookings.manage')
ON CONFLICT DO NOTHING;
