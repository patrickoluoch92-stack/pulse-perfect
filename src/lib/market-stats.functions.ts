// Public read APIs for Phase 14 market intelligence. Read-only, no PII.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function pub() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const listCountyMarketStats = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        county: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = await pub();
    let q = supabase
      .from("county_market_stats")
      .select("*")
      .order("rollup_date", { ascending: false })
      .order("hotspot_score", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.county) q = q.eq("county", data.county.toLowerCase());
    const { data: rows, error } = await q;
    if (error) return { rows: [] as any[], error: error.message };
    return { rows: rows ?? [] };
  });

export const listHeatmapCells = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        county: z.string().optional(),
        limit: z.number().int().min(1).max(2000).default(500),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = await pub();
    let q = supabase
      .from("heatmap_cells")
      .select(
        "cell_key, lat_bucket, lng_bucket, county, listing_count, bookings_30d, avg_nightly_rate, intensity, rollup_date",
      )
      .order("rollup_date", { ascending: false })
      .limit(data.limit);
    if (data.county) q = q.eq("county", data.county.toLowerCase());
    const { data: rows, error } = await q;
    if (error) return { rows: [] as any[], error: error.message };
    return { rows: rows ?? [] };
  });
