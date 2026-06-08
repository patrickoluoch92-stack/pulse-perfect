
-- =========================================================
-- Tour Operator module
-- =========================================================

-- Reusable updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.tour_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------- tour_packages ----------
CREATE TABLE public.tour_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 1 AND duration_days <= 365),
  base_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  max_capacity INTEGER NOT NULL DEFAULT 10 CHECK (max_capacity >= 1 AND max_capacity <= 10000),
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tour_packages_org ON public.tour_packages(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_packages TO authenticated;
GRANT ALL ON public.tour_packages TO service_role;
ALTER TABLE public.tour_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_packages select org members"
  ON public.tour_packages FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tour_packages insert managers"
  ON public.tour_packages FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_packages update managers"
  ON public.tour_packages FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_packages delete managers"
  ON public.tour_packages FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER trg_tour_packages_updated_at
  BEFORE UPDATE ON public.tour_packages
  FOR EACH ROW EXECUTE FUNCTION public.tour_set_updated_at();

-- ---------- tour_guides ----------
CREATE TABLE public.tour_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  bio TEXT,
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tour_guides_org ON public.tour_guides(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_guides TO authenticated;
GRANT ALL ON public.tour_guides TO service_role;
ALTER TABLE public.tour_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_guides select org members"
  ON public.tour_guides FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tour_guides insert managers"
  ON public.tour_guides FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_guides update managers"
  ON public.tour_guides FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_guides delete managers"
  ON public.tour_guides FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER trg_tour_guides_updated_at
  BEFORE UPDATE ON public.tour_guides
  FOR EACH ROW EXECUTE FUNCTION public.tour_set_updated_at();

-- ---------- tour_departures ----------
CREATE TABLE public.tour_departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.tour_packages(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  price_cents_override INTEGER CHECK (price_cents_override IS NULL OR price_cents_override >= 0),
  seats_sold INTEGER NOT NULL DEFAULT 0 CHECK (seats_sold >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','cancelled','completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX idx_tour_departures_org ON public.tour_departures(org_id);
CREATE INDEX idx_tour_departures_pkg ON public.tour_departures(package_id);
CREATE INDEX idx_tour_departures_starts ON public.tour_departures(org_id, starts_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_departures TO authenticated;
GRANT ALL ON public.tour_departures TO service_role;
ALTER TABLE public.tour_departures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_departures select org members"
  ON public.tour_departures FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tour_departures insert managers"
  ON public.tour_departures FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_departures update managers"
  ON public.tour_departures FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_departures delete managers"
  ON public.tour_departures FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER trg_tour_departures_updated_at
  BEFORE UPDATE ON public.tour_departures
  FOR EACH ROW EXECUTE FUNCTION public.tour_set_updated_at();

-- ---------- tour_departure_guides (assignments) ----------
CREATE TABLE public.tour_departure_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  departure_id UUID NOT NULL REFERENCES public.tour_departures(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.tour_guides(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (departure_id, guide_id)
);
CREATE INDEX idx_tour_dep_guides_org ON public.tour_departure_guides(org_id);
CREATE INDEX idx_tour_dep_guides_dep ON public.tour_departure_guides(departure_id);
CREATE INDEX idx_tour_dep_guides_guide ON public.tour_departure_guides(guide_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_departure_guides TO authenticated;
GRANT ALL ON public.tour_departure_guides TO service_role;
ALTER TABLE public.tour_departure_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_dep_guides select org members"
  ON public.tour_departure_guides FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tour_dep_guides insert managers"
  ON public.tour_departure_guides FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_dep_guides delete managers"
  ON public.tour_departure_guides FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

-- ---------- tour_bookings ----------
CREATE TABLE public.tour_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  departure_id UUID NOT NULL REFERENCES public.tour_departures(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  guests_count INTEGER NOT NULL DEFAULT 1 CHECK (guests_count >= 1 AND guests_count <= 1000),
  total_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tour_bookings_org ON public.tour_bookings(org_id);
CREATE INDEX idx_tour_bookings_dep ON public.tour_bookings(departure_id);
CREATE INDEX idx_tour_bookings_status ON public.tour_bookings(org_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_bookings TO authenticated;
GRANT ALL ON public.tour_bookings TO service_role;
ALTER TABLE public.tour_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_bookings select org members"
  ON public.tour_bookings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "tour_bookings insert managers"
  ON public.tour_bookings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_bookings update managers"
  ON public.tour_bookings FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));
CREATE POLICY "tour_bookings delete managers"
  ON public.tour_bookings FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::org_role[]));

CREATE TRIGGER trg_tour_bookings_updated_at
  BEFORE UPDATE ON public.tour_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tour_set_updated_at();
