
CREATE TABLE public.county_market_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county text NOT NULL,
  category text,
  rollup_date date NOT NULL,
  listing_count integer NOT NULL DEFAULT 0,
  discovered_count integer NOT NULL DEFAULT 0,
  bookings_30d integer NOT NULL DEFAULT 0,
  gmv_30d numeric(14,2) NOT NULL DEFAULT 0,
  avg_nightly_rate numeric(12,2),
  median_nightly_rate numeric(12,2),
  occupancy_proxy numeric(5,4),
  demand_index numeric(6,3),
  supply_index numeric(6,3),
  hotspot_score numeric(5,2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (county, category, rollup_date)
);

GRANT SELECT ON public.county_market_stats TO anon, authenticated;
GRANT ALL ON public.county_market_stats TO service_role;

ALTER TABLE public.county_market_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read county market stats"
  ON public.county_market_stats
  FOR SELECT
  USING (true);

CREATE INDEX idx_county_market_stats_county_date
  ON public.county_market_stats (county, rollup_date DESC);
CREATE INDEX idx_county_market_stats_hotspot
  ON public.county_market_stats (hotspot_score DESC NULLS LAST);


CREATE TABLE public.heatmap_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_key text NOT NULL,
  lat_bucket numeric(6,2) NOT NULL,
  lng_bucket numeric(6,2) NOT NULL,
  county text,
  listing_count integer NOT NULL DEFAULT 0,
  bookings_30d integer NOT NULL DEFAULT 0,
  avg_nightly_rate numeric(12,2),
  intensity numeric(5,3),
  rollup_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cell_key, rollup_date)
);

GRANT SELECT ON public.heatmap_cells TO anon, authenticated;
GRANT ALL ON public.heatmap_cells TO service_role;

ALTER TABLE public.heatmap_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read heatmap cells"
  ON public.heatmap_cells
  FOR SELECT
  USING (true);

CREATE INDEX idx_heatmap_cells_date
  ON public.heatmap_cells (rollup_date DESC);
CREATE INDEX idx_heatmap_cells_county
  ON public.heatmap_cells (county);


CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_county_market_stats_updated
  BEFORE UPDATE ON public.county_market_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE TRIGGER trg_heatmap_cells_updated
  BEFORE UPDATE ON public.heatmap_cells
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
