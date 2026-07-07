-- Extend property category enum with new taxonomy (backward compatible; existing values preserved)
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'bnb';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'boutique_hotel';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'holiday_home';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'hostel';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'conservancy';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'ranch';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'safari_camp';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'luxury_tented_camp';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'eco_lodge';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'campsite';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'glamping';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'mountain_lodge';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'beach_villa';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'lakefront_property';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'forest_retreat';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'conference_centre';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'wedding_venue';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'corporate_retreat';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'team_building_venue';
ALTER TYPE public.mkt_property_category ADD VALUE IF NOT EXISTS 'wellness_retreat';

-- Extend marketplace_properties with richer classification & filter fields
ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS secondary_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attributes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nearby_parks text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS best_seasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS check_in_time text,
  ADD COLUMN IF NOT EXISTS check_out_time text,
  ADD COLUMN IF NOT EXISTS sustainability_notes text,
  ADD COLUMN IF NOT EXISTS accessibility_notes text;

CREATE INDEX IF NOT EXISTS idx_mkt_props_activities ON public.marketplace_properties USING gin (activities);
CREATE INDEX IF NOT EXISTS idx_mkt_props_attributes ON public.marketplace_properties USING gin (attributes);
CREATE INDEX IF NOT EXISTS idx_mkt_props_secondary_cats ON public.marketplace_properties USING gin (secondary_categories);
CREATE INDEX IF NOT EXISTS idx_mkt_props_nearby_parks ON public.marketplace_properties USING gin (nearby_parks);