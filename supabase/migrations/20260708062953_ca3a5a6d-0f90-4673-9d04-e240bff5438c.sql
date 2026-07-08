-- Extend property category enum with residential, commercial, agricultural & land types.
-- All ADD VALUE IF NOT EXISTS so re-running is safe.

-- Residential
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'bedsitter';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'single_room';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'studio';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'one_bedroom';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'two_bedroom';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'three_bedroom';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'four_bedroom';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'apartment';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'flat';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'maisonette';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'townhouse';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'standalone_house';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'bungalow';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'duplex';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'penthouse';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'gated_community_home';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'student_hostel';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'staff_housing';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'senior_living';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'cottage';

-- Commercial
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'office_space';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'shop';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'retail_space';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'godown';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'industrial_building';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'business_park';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'coworking_space';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'hotel_for_sale';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'restaurant_lease';

-- Agricultural & special
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'agricultural_land';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'tea_farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'coffee_farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'flower_farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'dairy_farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'poultry_farm';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'fish_farm';

-- Land plots
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'residential_plot';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'commercial_plot';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'industrial_plot';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'beach_plot';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'lakefront_plot';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'riverfront_plot';

-- Rental / sale / land specific fields on marketplace_properties (all additive & nullable).
ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS listing_intent text NOT NULL DEFAULT 'short_stay',
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms integer,
  ADD COLUMN IF NOT EXISTS furnished boolean,
  ADD COLUMN IF NOT EXISTS parking_spaces integer,
  ADD COLUMN IF NOT EXISTS land_size_acres numeric(10,3),
  ADD COLUMN IF NOT EXISTS rent_monthly numeric(12,2),
  ADD COLUMN IF NOT EXISTS rent_weekly numeric(12,2),
  ADD COLUMN IF NOT EXISTS rent_daily numeric(12,2),
  ADD COLUMN IF NOT EXISTS sale_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS security_deposit numeric(12,2),
  ADD COLUMN IF NOT EXISTS service_charge numeric(12,2),
  ADD COLUMN IF NOT EXISTS lease_period_months integer,
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS occupancy_status text,
  ADD COLUMN IF NOT EXISTS constituency text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS estate text,
  ADD COLUMN IF NOT EXISTS neighbourhood text;

CREATE INDEX IF NOT EXISTS idx_mkt_props_listing_intent ON public.marketplace_properties (listing_intent);
CREATE INDEX IF NOT EXISTS idx_mkt_props_bedrooms ON public.marketplace_properties (bedrooms);
CREATE INDEX IF NOT EXISTS idx_mkt_props_estate ON public.marketplace_properties (estate);
CREATE INDEX IF NOT EXISTS idx_mkt_props_ward ON public.marketplace_properties (ward);
CREATE INDEX IF NOT EXISTS idx_mkt_props_constituency ON public.marketplace_properties (constituency);
CREATE INDEX IF NOT EXISTS idx_mkt_props_rent_monthly ON public.marketplace_properties (rent_monthly);
CREATE INDEX IF NOT EXISTS idx_mkt_props_sale_price ON public.marketplace_properties (sale_price);