
-- Extend mobility_vehicles with granular listing fields
ALTER TABLE public.mobility_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS trim text,
  ADD COLUMN IF NOT EXISTS promo_price_kes numeric,
  ADD COLUMN IF NOT EXISTS is_luxury boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_electric boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hybrid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_wedding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_safari boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_book boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_type ON public.mobility_vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_flags ON public.mobility_vehicles(is_luxury, is_electric, is_hybrid, is_wedding, is_safari);

-- Extend mobility_providers with service categories (multiple business categories per provider)
ALTER TABLE public.mobility_providers
  ADD COLUMN IF NOT EXISTS service_categories text[] NOT NULL DEFAULT '{}'::text[];
