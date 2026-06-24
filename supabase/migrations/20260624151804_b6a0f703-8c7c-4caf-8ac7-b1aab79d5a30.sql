-- Partner inventory cache for Booking.com and Expedia EPS Rapid results
CREATE TABLE public.external_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('booking','expedia')),
  external_id text NOT NULL,
  name text NOT NULL,
  town text,
  county_code text,
  country_code text NOT NULL DEFAULT 'KE',
  latitude double precision,
  longitude double precision,
  image_url text,
  price_per_night numeric(12,2),
  currency text,
  rating numeric(3,2),
  review_count integer,
  deeplink_url text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX external_listings_county_idx ON public.external_listings (county_code);
CREATE INDEX external_listings_provider_idx ON public.external_listings (provider);
CREATE INDEX external_listings_synced_idx ON public.external_listings (last_synced_at DESC);

GRANT SELECT ON public.external_listings TO anon;
GRANT SELECT ON public.external_listings TO authenticated;
GRANT ALL ON public.external_listings TO service_role;

ALTER TABLE public.external_listings ENABLE ROW LEVEL SECURITY;

-- Public read access (this is partner inventory we want to display to visitors)
CREATE POLICY "Anyone can read partner listings"
  ON public.external_listings FOR SELECT
  USING (true);

-- Writes are service_role only (server functions using admin client)

CREATE TRIGGER external_listings_set_updated_at
  BEFORE UPDATE ON public.external_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();