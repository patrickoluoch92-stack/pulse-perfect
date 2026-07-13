
-- Expand mobility_providers with full business registration fields
ALTER TABLE public.mobility_providers
  ADD COLUMN IF NOT EXISTS business_reg_number text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS tax_pin text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS county_code text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS policies text,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS verification_docs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Expand mobility_vehicles with rich profile fields
ALTER TABLE public.mobility_vehicles
  ADD COLUMN IF NOT EXISTS drive_type text,
  ADD COLUMN IF NOT EXISTS engine_size text,
  ADD COLUMN IF NOT EXISTS doors integer,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS accessibility jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mileage_policy text,
  ADD COLUMN IF NOT EXISTS min_driver_age integer,
  ADD COLUMN IF NOT EXISTS license_requirements text,
  ADD COLUMN IF NOT EXISTS fuel_policy text,
  ADD COLUMN IF NOT EXISTS has_child_seat boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_bluetooth boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_plate text,
  ADD COLUMN IF NOT EXISTS main_image_url text;

-- Seasonal / promotional pricing table
CREATE TABLE IF NOT EXISTS public.mobility_seasonal_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE CASCADE,
  label text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  unit text NOT NULL CHECK (unit IN ('hour','day','week','month')),
  price_kes numeric NOT NULL CHECK (price_kes >= 0),
  promo_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mobility_seasonal_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobility_seasonal_rates TO authenticated;
GRANT ALL ON public.mobility_seasonal_rates TO service_role;

ALTER TABLE public.mobility_seasonal_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read seasonal rates for approved vehicles"
  ON public.mobility_seasonal_rates FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mobility_vehicles v
    WHERE v.id = vehicle_id AND v.status = 'approved'
  ));

CREATE POLICY "org members manage seasonal rates"
  ON public.mobility_seasonal_rates FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mobility_vehicles v
    WHERE v.id = vehicle_id AND public.is_org_member(auth.uid(), v.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mobility_vehicles v
    WHERE v.id = vehicle_id AND public.is_org_member(auth.uid(), v.org_id)
  ));

CREATE INDEX IF NOT EXISTS mobility_seasonal_rates_vehicle_idx
  ON public.mobility_seasonal_rates (vehicle_id, starts_on, ends_on);

DROP TRIGGER IF EXISTS trg_mobility_seasonal_rates_updated ON public.mobility_seasonal_rates;
CREATE TRIGGER trg_mobility_seasonal_rates_updated
  BEFORE UPDATE ON public.mobility_seasonal_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- Provider verification helper: only admins can flip verification_status to verified
CREATE OR REPLACE FUNCTION public.mobility_guard_provider_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF is_admin THEN
    IF NEW.verification_status <> OLD.verification_status AND NEW.verification_status = 'verified' THEN
      NEW.verified_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT (
      (OLD.verification_status = 'unverified' AND NEW.verification_status = 'pending') OR
      (OLD.verification_status = 'rejected' AND NEW.verification_status = 'pending') OR
      (OLD.verification_status = 'pending' AND NEW.verification_status = 'unverified')
    ) THEN
      RAISE EXCEPTION 'Only admins can set verification status to %', NEW.verification_status;
    END IF;
    IF NEW.verification_status = 'pending' THEN
      NEW.submitted_at := now();
    END IF;
  END IF;

  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Only admins can set rejection reason';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mobility_provider_verify ON public.mobility_providers;
CREATE TRIGGER trg_mobility_provider_verify
  BEFORE UPDATE ON public.mobility_providers
  FOR EACH ROW EXECUTE FUNCTION public.mobility_guard_provider_verification();
