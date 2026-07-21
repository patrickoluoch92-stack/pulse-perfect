
-- ============================================================================
-- HostPulse Professionals — foundation schema
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categories (hierarchical)
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.professional_categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_categories_parent ON public.professional_categories(parent_id);
CREATE INDEX idx_pro_categories_active ON public.professional_categories(active) WHERE active;

GRANT SELECT ON public.professional_categories TO anon, authenticated;
GRANT ALL ON public.professional_categories TO service_role;
ALTER TABLE public.professional_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly viewable"
  ON public.professional_categories FOR SELECT
  TO anon, authenticated USING (active = true);

CREATE POLICY "Platform admins manage categories"
  ON public.professional_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Professionals
-- ---------------------------------------------------------------------------
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.professional_categories(id),
  slug TEXT UNIQUE,

  -- Business info
  business_name TEXT NOT NULL,
  professional_name TEXT,
  tagline TEXT,
  description TEXT,
  years_experience INT,
  registration_status TEXT, -- 'individual' | 'registered_business' | 'agency'
  registration_number TEXT,
  tax_pin TEXT,

  -- Owner / identity
  full_name TEXT,
  id_document_path TEXT,
  profile_image_path TEXT,
  cover_image_path TEXT,
  logo_path TEXT,

  -- Coverage
  country TEXT DEFAULT 'Kenya',
  county_code TEXT,
  city TEXT,
  town TEXT,
  area TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  travels_to_clients BOOLEAN NOT NULL DEFAULT false,
  max_travel_km INT,
  nationwide BOOLEAN NOT NULL DEFAULT false,
  online_services BOOLEAN NOT NULL DEFAULT false,

  -- Contact
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,

  -- Availability
  working_hours JSONB, -- { mon: {open, close}, ... }
  emergency_bookings BOOLEAN NOT NULL DEFAULT false,
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  booking_lead_hours INT NOT NULL DEFAULT 24,

  -- Pricing
  pricing_model TEXT, -- 'hourly' | 'half_day' | 'full_day' | 'fixed' | 'starting_from' | 'custom_quote'
  starting_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'KES',
  travel_charges NUMERIC(12,2),
  deposit_percentage INT DEFAULT 30,
  cancellation_policy TEXT,

  -- Status & quality
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'pending' | 'approved' | 'suspended'
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_top_rated BOOLEAN NOT NULL DEFAULT false,
  quality_score INT DEFAULT 0,
  ai_summary TEXT,
  avg_response_minutes INT,
  avg_rating NUMERIC(3,2),
  review_count INT NOT NULL DEFAULT 0,
  booking_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pros_owner ON public.professionals(owner_id);
CREATE INDEX idx_pros_category ON public.professionals(category_id);
CREATE INDEX idx_pros_status ON public.professionals(status);
CREATE INDEX idx_pros_county ON public.professionals(county_code) WHERE status = 'approved';
CREATE INDEX idx_pros_featured ON public.professionals(is_featured, quality_score DESC) WHERE status = 'approved';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT SELECT ON public.professionals TO anon;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Public can see approved profiles. Contact PII columns are protected via column-level grants below.
CREATE POLICY "Approved professionals are publicly viewable"
  ON public.professionals FOR SELECT
  TO anon, authenticated USING (status = 'approved');

CREATE POLICY "Owners can view their own profile"
  ON public.professionals FOR SELECT
  TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owners can create their profile"
  ON public.professionals FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their profile"
  ON public.professionals FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their profile"
  ON public.professionals FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all professionals"
  ON public.professionals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Protect direct-contact PII from anon scraping. Owners/admins read via server fns using service role or auth context.
REVOKE SELECT (phone, whatsapp, email, id_document_path, tax_pin, registration_number)
  ON public.professionals FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Services
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INT,
  pricing_type TEXT, -- 'hourly' | 'flat' | 'starting_from' | 'quote'
  base_price NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_services_pro ON public.professional_services(professional_id);

GRANT SELECT ON public.professional_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;
GRANT ALL ON public.professional_services TO service_role;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services of approved pros are public"
  ON public.professional_services FOR SELECT
  TO anon, authenticated
  USING (
    active AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = professional_id AND p.status = 'approved'
    )
  );

CREATE POLICY "Owners manage their services"
  ON public.professional_services FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Packages
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  inclusions JSONB, -- array of strings
  price NUMERIC(12,2) NOT NULL,
  duration_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_packages_pro ON public.professional_packages(professional_id);

GRANT SELECT ON public.professional_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_packages TO authenticated;
GRANT ALL ON public.professional_packages TO service_role;
ALTER TABLE public.professional_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Packages of approved pros are public"
  ON public.professional_packages FOR SELECT
  TO anon, authenticated
  USING (
    active AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = professional_id AND p.status = 'approved'
    )
  );

CREATE POLICY "Owners manage their packages"
  ON public.professional_packages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Portfolio
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'photo' | 'video' | 'project' | 'certificate' | 'license' | 'award' | 'before_after'
  title TEXT,
  description TEXT,
  media_path TEXT,
  media_url TEXT,
  secondary_media_path TEXT, -- for before/after
  metadata JSONB,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_portfolio_pro ON public.professional_portfolio(professional_id);

GRANT SELECT ON public.professional_portfolio TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_portfolio TO authenticated;
GRANT ALL ON public.professional_portfolio TO service_role;
ALTER TABLE public.professional_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio of approved pros is public"
  ON public.professional_portfolio FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.status = 'approved'));

CREATE POLICY "Owners manage their portfolio"
  ON public.professional_portfolio FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Bookings
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.professional_services(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.professional_packages(id) ON DELETE SET NULL,

  event_date DATE NOT NULL,
  event_time TIME,
  duration_hours NUMERIC(6,2),
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  requirements TEXT,
  reference_files JSONB, -- array of {path,name}
  guest_count INT,

  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'declined' | 'more_info' | 'alternative_proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  professional_notes TEXT,
  customer_notes TEXT,
  proposed_alt_date DATE,
  proposed_alt_time TIME,

  quoted_amount NUMERIC(12,2),
  deposit_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'KES',

  payment_status TEXT NOT NULL DEFAULT 'unpaid',
    -- 'unpaid' | 'deposit_paid' | 'paid' | 'refunded' | 'failed'
  payment_provider TEXT, -- 'paddle' | 'mpesa'
  payment_reference TEXT,
  commission_amount NUMERIC(12,2),
  payout_status TEXT NOT NULL DEFAULT 'pending',

  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_reason TEXT,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_bookings_pro ON public.professional_bookings(professional_id, event_date);
CREATE INDEX idx_pro_bookings_customer ON public.professional_bookings(customer_id, created_at DESC);
CREATE INDEX idx_pro_bookings_status ON public.professional_bookings(status);

GRANT SELECT, INSERT, UPDATE ON public.professional_bookings TO authenticated;
GRANT ALL ON public.professional_bookings TO service_role;
ALTER TABLE public.professional_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer or professional sees the booking"
  ON public.professional_bookings FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Customer creates a booking"
  ON public.professional_bookings FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customer or professional updates the booking"
  ON public.professional_bookings FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Messages (realtime)
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.professional_bookings(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT,
  attachments JSONB, -- array of {path,name,mime}
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_msg_thread ON public.professional_messages(professional_id, customer_id, created_at DESC);
CREATE INDEX idx_pro_msg_booking ON public.professional_messages(booking_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.professional_messages TO authenticated;
GRANT ALL ON public.professional_messages TO service_role;
ALTER TABLE public.professional_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants read messages"
  ON public.professional_messages FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Thread participants send messages"
  ON public.professional_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      customer_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Recipient marks read"
  ON public.professional_messages FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 8. Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE public.professional_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.professional_bookings(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  professional_response TEXT,
  responded_at TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, customer_id)
);
CREATE INDEX idx_pro_reviews_pro ON public.professional_reviews(professional_id, created_at DESC);

GRANT SELECT ON public.professional_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.professional_reviews TO authenticated;
GRANT ALL ON public.professional_reviews TO service_role;
ALTER TABLE public.professional_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews of approved pros are public"
  ON public.professional_reviews FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.status = 'approved'));

CREATE POLICY "Customer creates review after completed booking"
  ON public.professional_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.professional_bookings b
      WHERE b.id = booking_id
        AND b.customer_id = auth.uid()
        AND b.status = 'completed'
    )
  );

CREATE POLICY "Customer edits own review"
  ON public.professional_reviews FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Professional posts a reply"
  ON public.professional_reviews FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers (reuse existing helper)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $f$
      BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

CREATE TRIGGER trg_pro_cat_updated BEFORE UPDATE ON public.professional_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pros_updated BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pro_svc_updated BEFORE UPDATE ON public.professional_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pro_pkg_updated BEFORE UPDATE ON public.professional_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pro_port_updated BEFORE UPDATE ON public.professional_portfolio FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pro_bkg_updated BEFORE UPDATE ON public.professional_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pro_rev_updated BEFORE UPDATE ON public.professional_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 10. Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.professional_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.professional_bookings;

-- ---------------------------------------------------------------------------
-- 11. Seed launch categories
-- ---------------------------------------------------------------------------
INSERT INTO public.professional_categories (parent_id, slug, name, icon, display_order) VALUES
  (NULL, 'events-media', 'Events & Media', 'camera', 10),
  (NULL, 'travel-tourism', 'Travel & Tourism', 'compass', 20),
  (NULL, 'home-property', 'Home & Property Services', 'home', 30);

WITH parents AS (SELECT id, slug FROM public.professional_categories WHERE parent_id IS NULL)
INSERT INTO public.professional_categories (parent_id, slug, name, icon, display_order)
SELECT p.id, s.slug, s.name, s.icon, s.ord FROM parents p
JOIN (VALUES
  ('events-media','videographers','Videographers','video',10),
  ('events-media','photographers','Photographers','camera',20),
  ('events-media','wedding-planners','Wedding Planners','heart',30),
  ('events-media','event-planners','Event Planners','calendar',40),
  ('events-media','djs','DJs','music',50),
  ('events-media','mcs','MCs','mic',60),
  ('events-media','decorators','Decorators','sparkles',70),
  ('events-media','caterers','Caterers','utensils',80),
  ('events-media','florists','Florists','flower',90),
  ('events-media','makeup-artists','Makeup Artists','brush',100),
  ('events-media','sound-lighting','Sound & Lighting','zap',110),
  ('events-media','equipment-rental','Equipment Rental','box',120),
  ('travel-tourism','tour-guides','Tour Guides','map',10),
  ('travel-tourism','safari-guides','Safari Guides','compass',20),
  ('travel-tourism','travel-coordinators','Travel Coordinators','plane',30),
  ('travel-tourism','translators','Translators','languages',40),
  ('travel-tourism','personal-drivers','Personal Drivers','car',50),
  ('travel-tourism','airport-meet-greet','Airport Meet & Greet','users',60),
  ('travel-tourism','tour-companies','Tour Companies','building',70),
  ('home-property','movers','Movers','truck',10),
  ('home-property','cleaning-services','Cleaning Services','sparkles',20),
  ('home-property','interior-designers','Interior Designers','palette',30),
  ('home-property','landscapers','Landscapers','tree',40)
) AS s(parent_slug, slug, name, icon, ord) ON s.parent_slug = p.slug;
