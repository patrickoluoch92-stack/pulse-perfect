// Phase 14: Market intelligence rollups. Aggregates listings + bookings into
// per-county and per-heatmap-cell stats. Server-only; invoked by cron hook.

type Sb = any;
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Recompute county_market_stats for today from live tables.
 */
export async function rollupCountyMarketStats() {
  const supabase = await getAdmin();
  const rollupDate = isoDate();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [propsRes, discoveredRes, bookingsRes] = await Promise.all([
    supabase.from("marketplace_properties").select("id, county, property_type, base_price, is_published"),
    supabase.from("discovered_properties").select("id, county, property_type, status"),
    supabase.from("marketplace_bookings").select("id, property_id, total_amount, created_at").gte("created_at", since30),
  ]);

  const props = (propsRes.data ?? []).filter((p: any) => p.is_published);
  const discovered = (discoveredRes.data ?? []).filter((d: any) =>
    ["ready", "moderated", "claimed"].includes(d.status),
  );
  const bookings = bookingsRes.data ?? [];
  const propById = new Map<string, any>();
  for (const p of props) propById.set(p.id, p);

  // Group by county+category
  type Key = string;
  const buckets = new Map<
    Key,
    {
      county: string;
      category: string | null;
      listings: any[];
      discovered: any[];
      bookings: any[];
    }
  >();

  function bucket(county: string | null, category: string | null): Key | null {
    if (!county) return null;
    const key = `${county.toLowerCase()}::${category ?? "any"}`;
    if (!buckets.has(key)) {
      buckets.set(key, { county: county.toLowerCase(), category, listings: [], discovered: [], bookings: [] });
    }
    return key;
  }

  for (const p of props) {
    const k = bucket(p.county, p.property_type);
    if (k) buckets.get(k)!.listings.push(p);
    // Also aggregate at county-level (category=null)
    const kAll = bucket(p.county, null);
    if (kAll) buckets.get(kAll)!.listings.push(p);
  }
  for (const d of discovered) {
    const k = bucket(d.county, d.property_type);
    if (k) buckets.get(k)!.discovered.push(d);
    const kAll = bucket(d.county, null);
    if (kAll) buckets.get(kAll)!.discovered.push(d);
  }
  for (const b of bookings) {
    const p = propById.get(b.property_id);
    if (!p) continue;
    const k = bucket(p.county, p.property_type);
    if (k) buckets.get(k)!.bookings.push(b);
    const kAll = bucket(p.county, null);
    if (kAll) buckets.get(kAll)!.bookings.push(b);
  }

  const rows: any[] = [];
  for (const bkt of buckets.values()) {
    const prices = bkt.listings.map((l) => Number(l.base_price)).filter((x) => Number.isFinite(x) && x > 0);
    const gmv = bkt.bookings.reduce((a, b) => a + Number(b.total_amount ?? 0), 0);
    const listingCount = bkt.listings.length;
    const bookingCount = bkt.bookings.length;
    // Rough occupancy proxy: bookings per listing over 30 days, capped at 1.
    const occupancy = listingCount > 0 ? Math.min(1, bookingCount / (listingCount * 30)) : 0;
    // Demand index: bookings per listing scaled 0..100.
    const demand = listingCount > 0 ? (bookingCount / listingCount) * 10 : 0;
    // Supply index: listings + discovered per county row, log-scaled.
    const supply = Math.log10(1 + listingCount + bkt.discovered.length) * 10;
    // Hotspot: high demand + moderate supply.
    const hotspot = Math.min(100, demand * 0.7 + Math.max(0, 20 - supply) * 0.3 + occupancy * 30);

    rows.push({
      county: bkt.county,
      category: bkt.category,
      rollup_date: rollupDate,
      listing_count: listingCount,
      discovered_count: bkt.discovered.length,
      bookings_30d: bookingCount,
      gmv_30d: Number(gmv.toFixed(2)),
      avg_nightly_rate: mean(prices),
      median_nightly_rate: median(prices),
      occupancy_proxy: Number(occupancy.toFixed(4)),
      demand_index: Number(demand.toFixed(3)),
      supply_index: Number(supply.toFixed(3)),
      hotspot_score: Number(hotspot.toFixed(2)),
      payload: { sample_prices: prices.length },
    });
  }

  if (rows.length === 0) return { rolled: 0 };
  const { error } = await supabase
    .from("county_market_stats")
    .upsert(rows, { onConflict: "county,category,rollup_date" });
  if (error) throw new Error(error.message);
  return { rolled: rows.length };
}

/**
 * Recompute heatmap_cells at 0.1° resolution.
 */
export async function rollupHeatmapCells() {
  const supabase = await getAdmin();
  const rollupDate = isoDate();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: props } = await supabase
    .from("marketplace_properties")
    .select("id, county, latitude, longitude, base_price, is_published")
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  const { data: bookings } = await supabase
    .from("marketplace_bookings")
    .select("property_id, created_at")
    .gte("created_at", since30);

  const bookingsByProp = new Map<string, number>();
  for (const b of bookings ?? []) {
    bookingsByProp.set(b.property_id, (bookingsByProp.get(b.property_id) ?? 0) + 1);
  }

  const cells = new Map<
    string,
    { latBucket: number; lngBucket: number; county: string | null; prices: number[]; listings: number; bookings: number }
  >();

  for (const p of (props ?? []).filter((x: any) => x.is_published)) {
    const lat = Math.round(Number(p.latitude) * 10) / 10;
    const lng = Math.round(Number(p.longitude) * 10) / 10;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(1)}:${lng.toFixed(1)}`;
    const cell = cells.get(key) ?? {
      latBucket: lat,
      lngBucket: lng,
      county: (p.county ?? null) as string | null,
      prices: [] as number[],
      listings: 0,
      bookings: 0,
    };
    cell.listings += 1;
    if (p.base_price) cell.prices.push(Number(p.base_price));
    cell.bookings += bookingsByProp.get(p.id) ?? 0;
    cells.set(key, cell);
  }


  let maxIntensity = 1;
  for (const c of cells.values()) maxIntensity = Math.max(maxIntensity, c.listings + c.bookings * 2);

  const rows = Array.from(cells.entries()).map(([key, c]) => ({
    cell_key: key,
    lat_bucket: c.latBucket,
    lng_bucket: c.lngBucket,
    county: c.county ? String(c.county).toLowerCase() : null,
    listing_count: c.listings,
    bookings_30d: c.bookings,
    avg_nightly_rate: mean(c.prices),
    intensity: Number(((c.listings + c.bookings * 2) / maxIntensity).toFixed(3)),
    rollup_date: rollupDate,
  }));

  if (rows.length === 0) return { rolled: 0 };
  const { error } = await supabase
    .from("heatmap_cells")
    .upsert(rows, { onConflict: "cell_key,rollup_date" });
  if (error) throw new Error(error.message);
  return { rolled: rows.length };
}

export async function runMarketStatsTick() {
  const [county, heatmap] = await Promise.all([rollupCountyMarketStats(), rollupHeatmapCells()]);
  return { county, heatmap };
}
