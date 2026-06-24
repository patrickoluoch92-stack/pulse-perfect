
-- =========================================================
-- Reviews
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_property_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, reviewer_id)
);

GRANT SELECT ON public.marketplace_property_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_property_reviews TO authenticated;
GRANT ALL ON public.marketplace_property_reviews TO service_role;

ALTER TABLE public.marketplace_property_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read"
  ON public.marketplace_property_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      WHERE p.id = property_id AND p.status = 'approved'
    )
  );

CREATE POLICY "reviews_self_insert"
  ON public.marketplace_property_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "reviews_self_update"
  ON public.marketplace_property_reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "reviews_self_or_owner_or_admin_delete"
  ON public.marketplace_property_reviews
  FOR DELETE TO authenticated
  USING (
    auth.uid() = reviewer_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      WHERE p.id = property_id
        AND public.is_org_member(auth.uid(), p.org_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_mkt_reviews_property ON public.marketplace_property_reviews(property_id);

CREATE TRIGGER trg_mkt_reviews_updated_at
  BEFORE UPDATE ON public.marketplace_property_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure rating aggregate columns exist on properties
ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- Aggregation trigger
CREATE OR REPLACE FUNCTION public.mkt_refresh_property_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid := COALESCE(NEW.property_id, OLD.property_id);
BEGIN
  UPDATE public.marketplace_properties p
  SET
    rating_count = COALESCE((SELECT COUNT(*) FROM public.marketplace_property_reviews WHERE property_id = target_id), 0),
    rating_avg   = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.marketplace_property_reviews WHERE property_id = target_id), 0)
  WHERE p.id = target_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_mkt_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_property_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mkt_refresh_property_rating();

-- =========================================================
-- Bookings
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.marketplace_booking_status AS ENUM ('pending','confirmed','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE RESTRICT,
  guest_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests_count integer NOT NULL DEFAULT 1 CHECK (guests_count > 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  status public.marketplace_booking_status NOT NULL DEFAULT 'pending',
  mpesa_transaction_id uuid REFERENCES public.mpesa_transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_bookings TO authenticated;
GRANT ALL ON public.marketplace_bookings TO service_role;

ALTER TABLE public.marketplace_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_guest_read"
  ON public.marketplace_bookings FOR SELECT TO authenticated
  USING (
    auth.uid() = guest_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      WHERE p.id = property_id AND public.is_org_member(auth.uid(), p.org_id)
    )
  );

CREATE POLICY "bookings_guest_insert"
  ON public.marketplace_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "bookings_owner_or_admin_update"
  ON public.marketplace_bookings FOR UPDATE TO authenticated
  USING (
    auth.uid() = guest_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      WHERE p.id = property_id AND public.is_org_member(auth.uid(), p.org_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_mkt_bookings_property ON public.marketplace_bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_mkt_bookings_guest ON public.marketplace_bookings(guest_id);

CREATE TRIGGER trg_mkt_bookings_updated_at
  BEFORE UPDATE ON public.marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Search performance indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_mkt_properties_amenities_gin
  ON public.marketplace_properties USING GIN (amenities);
CREATE INDEX IF NOT EXISTS idx_mkt_properties_price
  ON public.marketplace_properties (price_per_night);
CREATE INDEX IF NOT EXISTS idx_mkt_properties_rating
  ON public.marketplace_properties (rating_avg DESC);
