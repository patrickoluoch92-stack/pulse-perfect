
-- ENUMS
DO $$ BEGIN CREATE TYPE public.mobility_category AS ENUM ('self_drive','chauffeur','airport_transfer','executive','tour_van','safari_4x4','luxury','wedding','shuttle','bus','motorcycle','bicycle','boat'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mobility_status AS ENUM ('draft','pending','approved','rejected','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mobility_rate_unit AS ENUM ('hour','day','week','month'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mobility_booking_status AS ENUM ('pending','confirmed','in_progress','completed','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mobility_driver_option AS ENUM ('self','chauffeur'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PROVIDERS
CREATE TABLE IF NOT EXISTS public.mobility_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  bio TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  service_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status public.mobility_status NOT NULL DEFAULT 'pending',
  rating_avg NUMERIC(3,2),
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobility_providers_org ON public.mobility_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_mobility_providers_status ON public.mobility_providers(verification_status);
GRANT SELECT ON public.mobility_providers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_providers TO authenticated;
GRANT ALL ON public.mobility_providers TO service_role;
REVOKE SELECT (contact_email, contact_phone) ON public.mobility_providers FROM anon;
ALTER TABLE public.mobility_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_public_read_approved" ON public.mobility_providers FOR SELECT USING (verification_status = 'approved');
CREATE POLICY "providers_org_read" ON public.mobility_providers FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "providers_org_insert" ON public.mobility_providers FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "providers_org_update" ON public.mobility_providers FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "providers_admin_delete" ON public.mobility_providers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_mobility_providers_updated BEFORE UPDATE ON public.mobility_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- VEHICLES
CREATE TABLE IF NOT EXISTS public.mobility_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.mobility_providers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  category public.mobility_category NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  transmission TEXT CHECK (transmission IN ('automatic','manual')),
  fuel_type TEXT,
  seats INT,
  luggage INT,
  has_ac BOOLEAN NOT NULL DEFAULT false,
  has_gps BOOLEAN NOT NULL DEFAULT false,
  insurance_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  security_deposit_kes NUMERIC(12,2),
  pickup_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  dropoff_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  county_code TEXT,
  town TEXT,
  description TEXT,
  status public.mobility_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  rating_avg NUMERIC(3,2),
  rating_count INT NOT NULL DEFAULT 0,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_provider ON public.mobility_vehicles(provider_id);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_org ON public.mobility_vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_status ON public.mobility_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_category ON public.mobility_vehicles(category);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_county ON public.mobility_vehicles(county_code);
GRANT SELECT ON public.mobility_vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_vehicles TO authenticated;
GRANT ALL ON public.mobility_vehicles TO service_role;
ALTER TABLE public.mobility_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_public_read_approved" ON public.mobility_vehicles FOR SELECT USING (status = 'approved');
CREATE POLICY "vehicles_org_read" ON public.mobility_vehicles FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vehicles_org_insert" ON public.mobility_vehicles FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "vehicles_org_update" ON public.mobility_vehicles FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vehicles_org_delete" ON public.mobility_vehicles FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_mobility_vehicles_updated BEFORE UPDATE ON public.mobility_vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- RATES
CREATE TABLE IF NOT EXISTS public.mobility_vehicle_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  unit public.mobility_rate_unit NOT NULL,
  price_kes NUMERIC(12,2) NOT NULL CHECK (price_kes >= 0),
  min_units INT NOT NULL DEFAULT 1,
  included_km INT,
  extra_km_kes NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, unit)
);
CREATE INDEX IF NOT EXISTS idx_mobility_rates_vehicle ON public.mobility_vehicle_rates(vehicle_id);
GRANT SELECT ON public.mobility_vehicle_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_vehicle_rates TO authenticated;
GRANT ALL ON public.mobility_vehicle_rates TO service_role;
ALTER TABLE public.mobility_vehicle_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_public_read" ON public.mobility_vehicle_rates FOR SELECT USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND v.status = 'approved'));
CREATE POLICY "rates_org_manage" ON public.mobility_vehicle_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))));
CREATE TRIGGER trg_mobility_rates_updated BEFORE UPDATE ON public.mobility_vehicle_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- IMAGES
CREATE TABLE IF NOT EXISTS public.mobility_vehicle_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobility_images_vehicle ON public.mobility_vehicle_images(vehicle_id, sort_order);
GRANT SELECT ON public.mobility_vehicle_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_vehicle_images TO authenticated;
GRANT ALL ON public.mobility_vehicle_images TO service_role;
ALTER TABLE public.mobility_vehicle_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images_public_read" ON public.mobility_vehicle_images FOR SELECT USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND v.status = 'approved'));
CREATE POLICY "images_org_manage" ON public.mobility_vehicle_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))));

-- AVAILABILITY
CREATE TABLE IF NOT EXISTS public.mobility_availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  booking_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_mobility_blocks_vehicle ON public.mobility_availability_blocks(vehicle_id, start_at);
GRANT SELECT ON public.mobility_availability_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_availability_blocks TO authenticated;
GRANT ALL ON public.mobility_availability_blocks TO service_role;
ALTER TABLE public.mobility_availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_public_read" ON public.mobility_availability_blocks FOR SELECT USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND v.status = 'approved'));
CREATE POLICY "blocks_org_manage" ON public.mobility_availability_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mobility_vehicles v WHERE v.id = vehicle_id AND (public.is_org_member(auth.uid(), v.org_id) OR public.has_role(auth.uid(), 'admin'))));

-- BOOKINGS
CREATE TABLE IF NOT EXISTS public.mobility_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES public.mobility_providers(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  pickup_at TIMESTAMPTZ NOT NULL,
  dropoff_at TIMESTAMPTZ NOT NULL,
  pickup_location TEXT,
  dropoff_location TEXT,
  driver_option public.mobility_driver_option NOT NULL DEFAULT 'self',
  total_kes NUMERIC(12,2) NOT NULL,
  deposit_kes NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.mobility_booking_status NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (dropoff_at > pickup_at)
);
CREATE INDEX IF NOT EXISTS idx_mobility_bookings_vehicle ON public.mobility_bookings(vehicle_id, pickup_at);
CREATE INDEX IF NOT EXISTS idx_mobility_bookings_org ON public.mobility_bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_mobility_bookings_guest ON public.mobility_bookings(guest_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_bookings TO authenticated;
GRANT ALL ON public.mobility_bookings TO service_role;
ALTER TABLE public.mobility_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_read" ON public.mobility_bookings FOR SELECT TO authenticated USING (
  guest_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = mobility_bookings.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','enterprise_admin','admin','manager','staff'))
);
CREATE POLICY "bookings_guest_insert" ON public.mobility_bookings FOR INSERT TO authenticated WITH CHECK (guest_user_id = auth.uid());
CREATE POLICY "bookings_org_update" ON public.mobility_bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = mobility_bookings.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','enterprise_admin','admin','manager')))
  WITH CHECK (true);
CREATE TRIGGER trg_mobility_bookings_updated BEFORE UPDATE ON public.mobility_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- REVIEWS
CREATE TABLE IF NOT EXISTS public.mobility_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.mobility_providers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobility_reviews_vehicle ON public.mobility_reviews(vehicle_id);
GRANT SELECT ON public.mobility_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_reviews TO authenticated;
GRANT ALL ON public.mobility_reviews TO service_role;
ALTER TABLE public.mobility_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read_approved" ON public.mobility_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "reviews_author_read" ON public.mobility_reviews FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reviews_author_insert" ON public.mobility_reviews FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "reviews_author_update" ON public.mobility_reviews FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reviews_admin_delete" ON public.mobility_reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_mobility_reviews_updated BEFORE UPDATE ON public.mobility_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- RBAC PERMISSION SEED
INSERT INTO public.rbac_permissions (key, category, label, description)
VALUES ('mobility.manage', 'mobility', 'Manage Mobility Fleet', 'Manage car-hire fleet, bookings, and provider profile')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.rbac_role_defaults (role, permission) VALUES
  ('owner','mobility.manage'),
  ('enterprise_admin','mobility.manage'),
  ('admin','mobility.manage'),
  ('manager','mobility.manage')
ON CONFLICT DO NOTHING;
