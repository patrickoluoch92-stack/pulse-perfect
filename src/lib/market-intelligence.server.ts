// Market Intelligence: aggregate booking + competitor signals into
// demand forecasts stored in pricing_signals for the pricing engine to consume.
// Server-only helpers (loaded via cron hook).

type Sb = any;

interface DemandStats {
  regionCode: string;
  occupancy: number; // 0..1
  paceDelta: number; // vs prior week
  bookingsWeek: number;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute per-region demand stats from marketplace_bookings for a rolling window.
 */
export async function computeRegionalDemand(days = 14): Promise<DemandStats[]> {
  const supabase = await getAdmin();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const prior = new Date(Date.now() - 2 * days * 86400_000).toISOString();

  const { data: recent } = await supabase
    .from("marketplace_bookings")
    .select("id, property_id, created_at")
    .gte("created_at", since);
  const { data: previous } = await supabase
    .from("marketplace_bookings")
    .select("id, property_id, created_at")
    .gte("created_at", prior)
    .lt("created_at", since);

  const propIds = Array.from(
    new Set(
      [...(recent ?? []), ...(previous ?? [])].map((b: any) => b.property_id).filter(Boolean),
    ),
  );
  if (propIds.length === 0) return [];

  const { data: props } = await supabase
    .from("marketplace_properties")
    .select("id, county")
    .in("id", propIds);
  const regionByProp = new Map<string, string>();
  for (const p of props ?? []) regionByProp.set(p.id, (p.county ?? "unknown").toLowerCase());

  const buckets = new Map<string, { recent: number; prev: number }>();
  for (const b of recent ?? []) {
    const r = regionByProp.get(b.property_id) ?? "unknown";
    const entry = buckets.get(r) ?? { recent: 0, prev: 0 };
    entry.recent += 1;
    buckets.set(r, entry);
  }
  for (const b of previous ?? []) {
    const r = regionByProp.get(b.property_id) ?? "unknown";
    const entry = buckets.get(r) ?? { recent: 0, prev: 0 };
    entry.prev += 1;
    buckets.set(r, entry);
  }

  const out: DemandStats[] = [];
  for (const [region, { recent: r, prev: p }] of buckets) {
    const paceDelta = p === 0 ? (r > 0 ? 1 : 0) : (r - p) / p;
    // rough occupancy proxy: bookings per property in region
    const propsInRegion = Array.from(regionByProp.values()).filter((x) => x === region).length || 1;
    const occupancy = Math.min(1, r / (propsInRegion * days));
    out.push({ regionCode: region, occupancy, paceDelta, bookingsWeek: r });
  }
  return out;
}

/**
 * Persist demand stats as pricing_signals (signal_type=demand_spike or weather-neutral).
 * Uses observed_on=today, valid_until=+7d, weight scaled by pace delta.
 */
export async function persistDemandSignals(stats: DemandStats[]) {
  if (stats.length === 0) return { inserted: 0 };
  const supabase = await getAdmin();
  const today = isoDate(new Date());
  const validUntil = isoDate(new Date(Date.now() + 7 * 86400_000));

  const rows = stats
    .filter((s) => Math.abs(s.paceDelta) > 0.2 || s.occupancy > 0.6)
    .map((s) => ({
      property_id: null,
      org_id: null,
      signal_type: "demand_spike",
      region_code: s.regionCode,
      observed_on: today,
      valid_until: validUntil,
      price_amount: null,
      currency: "KES",
      weight: Math.max(0.2, Math.min(3, Math.abs(s.paceDelta) * 2 + s.occupancy)),
      payload: {
        occupancy: Number(s.occupancy.toFixed(3)),
        pace_delta: Number(s.paceDelta.toFixed(3)),
        bookings_week: s.bookingsWeek,
      },
      source: "market-intelligence:demand-tick",
    }));

  if (rows.length === 0) return { inserted: 0 };
  const { error } = await supabase.from("pricing_signals").insert(rows);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

/**
 * Ingest competitor rate observations (e.g. crawled from external_listings).
 * Groups by county+category and stores median rate as competitor_rate signal.
 */
export async function ingestCompetitorRates() {
  const supabase = await getAdmin();
  const { data: ext } = await supabase
    .from("external_listings")
    .select("region, property_type, nightly_rate, currency, updated_at")
    .not("nightly_rate", "is", null)
    .gte("updated_at", new Date(Date.now() - 30 * 86400_000).toISOString());

  const groups = new Map<string, number[]>();
  for (const r of ext ?? []) {
    if (!r.region || !r.nightly_rate) continue;
    const key = `${(r.region as string).toLowerCase()}::${r.property_type ?? "any"}`;
    const arr = groups.get(key) ?? [];
    arr.push(Number(r.nightly_rate));
    groups.set(key, arr);
  }
  const today = isoDate(new Date());
  const validUntil = isoDate(new Date(Date.now() + 14 * 86400_000));
  const rows: any[] = [];
  for (const [key, prices] of groups) {
    if (prices.length < 3) continue;
    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const [region, propertyType] = key.split("::");
    rows.push({
      property_id: null,
      org_id: null,
      signal_type: "competitor_rate",
      region_code: region,
      observed_on: today,
      valid_until: validUntil,
      price_amount: median,
      currency: "KES",
      weight: Math.min(2, Math.log10(prices.length + 1)),
      payload: { sample_size: prices.length, property_type: propertyType },
      source: "market-intelligence:competitor-tick",
    });
  }
  if (rows.length === 0) return { inserted: 0 };
  const { error } = await supabase.from("pricing_signals").insert(rows);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

export async function runMarketTick() {
  const demand = await computeRegionalDemand(14);
  const persisted = await persistDemandSignals(demand);
  const comp = await ingestCompetitorRates();
  return {
    regions: demand.length,
    demandSignals: persisted.inserted,
    competitorSignals: comp.inserted,
  };
}
