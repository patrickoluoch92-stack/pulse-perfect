// Server-only helpers for pulling inbound inventory from Booking.com Demand API
// and Expedia EPS Rapid. Never import this file from client code or from a
// route module's top level — load it inside a server-function handler via:
//   const mod = await import("@/lib/external-inventory.server");
//
// Operating modes (zero code changes between them):
//   • Mock      — no credentials needed. Returns deterministic fake inventory
//                 so the UI, admin, sync jobs, and cache table all work today.
//                 Triggered when PARTNERS_FORCE_MOCK=true OR credentials are
//                 absent for that provider.
//   • Live      — real Booking.com / Expedia EPS calls. Triggered as soon as
//                 the corresponding credentials are present in env.
//
// Feature flags (per-provider) — any of these disables the provider entirely:
//   BOOKING_COM_DISABLED=true
//   EXPEDIA_DISABLED=true
//
// Global flag — forces mock data regardless of credentials:
//   PARTNERS_FORCE_MOCK=true

export type ProviderId = "booking" | "expedia";
export type ProviderMode = "live" | "mock" | "disabled";

export type ExternalListing = {
  provider: ProviderId;
  external_id: string;
  name: string;
  town: string | null;
  county_code: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  price_per_night: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  deeplink_url: string;
  raw: unknown;
};

export type SearchInput = {
  destination?: string;
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string;
  guests?: number;
  limit?: number;
};

// ---------- Feature flags / provider status ----------

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export function getProviderMode(provider: ProviderId): ProviderMode {
  if (provider === "booking" && envFlag("BOOKING_COM_DISABLED")) return "disabled";
  if (provider === "expedia" && envFlag("EXPEDIA_DISABLED")) return "disabled";
  if (envFlag("PARTNERS_FORCE_MOCK")) return "mock";
  const hasCreds =
    provider === "booking"
      ? Boolean(process.env.BOOKING_COM_USERNAME && process.env.BOOKING_COM_PASSWORD)
      : Boolean(process.env.EXPEDIA_RAPID_API_KEY && process.env.EXPEDIA_RAPID_SHARED_SECRET);
  return hasCreds ? "live" : "mock";
}

export function getPartnerStatus() {
  return {
    booking: {
      mode: getProviderMode("booking"),
      hasCredentials: Boolean(
        process.env.BOOKING_COM_USERNAME && process.env.BOOKING_COM_PASSWORD,
      ),
    },
    expedia: {
      mode: getProviderMode("expedia"),
      hasCredentials: Boolean(
        process.env.EXPEDIA_RAPID_API_KEY && process.env.EXPEDIA_RAPID_SHARED_SECRET,
      ),
    },
    forceMock: envFlag("PARTNERS_FORCE_MOCK"),
  };
}

// ---------- Kenya county mapping (used to project partner listings onto local UI) ----------

const KENYA_COUNTY_BY_TOWN: Record<string, string> = {
  nairobi: "030", mombasa: "001", kisumu: "042", nakuru: "032", eldoret: "027",
  thika: "022", malindi: "003", kilifi: "003", lamu: "005", diani: "002",
  ukunda: "002", watamu: "003", naivasha: "032", narok: "033", kericho: "035",
  meru: "012", embu: "014", nyeri: "019", nanyuki: "013", kitale: "024",
  kakamega: "037", machakos: "016", kajiado: "034", garissa: "007",
  isiolo: "011", wajir: "008", marsabit: "010", mandera: "009",
  voi: "006", taveta: "006", kwale: "002", "tsavo": "006",
  "maasai mara": "033", "amboseli": "034", "samburu": "018", "laikipia": "031",
};

export function mapTownToCountyCode(town: string | null | undefined): string | null {
  if (!town) return null;
  const key = town.trim().toLowerCase();
  // Direct lookup
  if (KENYA_COUNTY_BY_TOWN[key]) return KENYA_COUNTY_BY_TOWN[key];
  // Substring match (e.g. "Nairobi, Kenya")
  for (const [k, code] of Object.entries(KENYA_COUNTY_BY_TOWN)) {
    if (key.includes(k)) return code;
  }
  return null;
}

// ---------- Booking.com Demand API ----------
// Docs: https://developers.booking.com/demand/docs/open-api
const BOOKING_BASE = "https://demandapi.booking.com/3.1";

function bookingAuthHeader() {
  const u = process.env.BOOKING_COM_USERNAME!;
  const p = process.env.BOOKING_COM_PASSWORD!;
  return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
}

export async function searchBookingComLive(input: SearchInput): Promise<ExternalListing[]> {
  const body = {
    booker: { country: "ke", platform: "desktop" },
    checkin: input.checkIn,
    checkout: input.checkOut,
    city: input.destination,
    rows: Math.min(input.limit ?? 25, 50),
    guests: { number_of_adults: input.guests ?? 2 },
    currency: "USD",
    extras: ["extra_charges", "products"],
  };
  const res = await fetch(`${BOOKING_BASE}/accommodations/search`, {
    method: "POST",
    headers: {
      Authorization: bookingAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Booking.com search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: number | string;
      accommodation?: {
        name?: string;
        location?: { city?: string; country?: string; latitude?: number; longitude?: number };
        photos?: { main_photo?: { url_max1280?: string; url_original?: string } };
        review_score?: number;
        review_count?: number;
      };
      product_price_breakdown?: { gross_amount_per_night?: { value?: number; currency?: string } };
      url?: string;
    }>;
  };
  return (json.data ?? []).map((row) => {
    const town = row.accommodation?.location?.city ?? null;
    return {
      provider: "booking" as const,
      external_id: String(row.id),
      name: row.accommodation?.name ?? "Booking.com property",
      town,
      county_code: mapTownToCountyCode(town),
      country_code: row.accommodation?.location?.country ?? "KE",
      latitude: row.accommodation?.location?.latitude ?? null,
      longitude: row.accommodation?.location?.longitude ?? null,
      image_url:
        row.accommodation?.photos?.main_photo?.url_max1280 ??
        row.accommodation?.photos?.main_photo?.url_original ??
        null,
      price_per_night: row.product_price_breakdown?.gross_amount_per_night?.value ?? null,
      currency: row.product_price_breakdown?.gross_amount_per_night?.currency ?? "USD",
      rating: typeof row.accommodation?.review_score === "number" ? row.accommodation.review_score : null,
      review_count: typeof row.accommodation?.review_count === "number" ? row.accommodation.review_count : null,
      deeplink_url: row.url ?? `https://www.booking.com/hotel/${row.id}.html`,
      raw: row,
    };
  });
}

// ---------- Expedia EPS Rapid ----------
// Docs: https://developers.expediagroup.com/docs/rapid
const EXPEDIA_BASE = "https://api.ean.com/v3";

function expediaAuthHeader() {
  const key = process.env.EXPEDIA_RAPID_API_KEY!;
  const secret = process.env.EXPEDIA_RAPID_SHARED_SECRET!;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

export async function searchExpediaLive(input: SearchInput): Promise<ExternalListing[]> {
  const url = new URL(`${EXPEDIA_BASE}/properties/availability`);
  if (input.checkIn) url.searchParams.set("checkin", input.checkIn);
  if (input.checkOut) url.searchParams.set("checkout", input.checkOut);
  url.searchParams.set("currency", "USD");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("country_code", "KE");
  url.searchParams.set("occupancy", String(input.guests ?? 2));
  url.searchParams.set("sales_channel", "website");
  url.searchParams.set("sales_environment", "hotel_only");
  url.searchParams.set("sort_type", "preferred");
  if (input.destination) url.searchParams.set("destination", input.destination);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: expediaAuthHeader(),
      Accept: "application/json",
      "Customer-Ip": "127.0.0.1",
      "Customer-Session-Id": crypto.randomUUID(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expedia search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<
    string,
    {
      property_id?: string;
      name?: string;
      address?: { city?: string; country_code?: string };
      location?: { coordinates?: { latitude?: number; longitude?: number } };
      thumbnail_url?: string;
      ratings?: { property?: { rating?: number; count?: number } };
      rate?: { totals?: { inclusive?: { billable_currency?: { value?: number; currency?: string } } } };
      links?: { web_details?: { href?: string } };
    }
  >;
  return Object.values(json).map((row) => {
    const town = row.address?.city ?? null;
    return {
      provider: "expedia" as const,
      external_id: String(row.property_id ?? ""),
      name: row.name ?? "Expedia property",
      town,
      county_code: mapTownToCountyCode(town),
      country_code: row.address?.country_code ?? "KE",
      latitude: row.location?.coordinates?.latitude ?? null,
      longitude: row.location?.coordinates?.longitude ?? null,
      image_url: row.thumbnail_url ?? null,
      price_per_night: row.rate?.totals?.inclusive?.billable_currency?.value ?? null,
      currency: row.rate?.totals?.inclusive?.billable_currency?.currency ?? "USD",
      rating: row.ratings?.property?.rating ?? null,
      review_count: row.ratings?.property?.count ?? null,
      deeplink_url:
        row.links?.web_details?.href ?? `https://www.expedia.com/h${row.property_id}.Hotel-Information`,
      raw: row,
    };
  });
}

// ---------- Mock data generator (deterministic per destination) ----------

const MOCK_TOWNS = [
  { town: "Nairobi", county: "030" },
  { town: "Mombasa", county: "001" },
  { town: "Diani", county: "002" },
  { town: "Watamu", county: "003" },
  { town: "Naivasha", county: "032" },
  { town: "Maasai Mara", county: "033" },
  { town: "Nanyuki", county: "013" },
  { town: "Kisumu", county: "042" },
  { town: "Amboseli", county: "034" },
  { town: "Lamu", county: "005" },
];

const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1280&q=80",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1280&q=80",
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1280&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1280&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1280&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1280&q=80",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockResults(provider: ProviderId, input: SearchInput): ExternalListing[] {
  const seed = hash(`${provider}:${input.destination ?? "all"}`);
  const count = Math.min(input.limit ?? 12, 12);
  const out: ExternalListing[] = [];
  const destFilter = input.destination?.toLowerCase().trim();
  let pool = MOCK_TOWNS;
  if (destFilter) {
    const matched = MOCK_TOWNS.filter((t) => t.town.toLowerCase().includes(destFilter));
    if (matched.length > 0) pool = matched;
  }
  for (let i = 0; i < count; i++) {
    const place = pool[(seed + i) % pool.length];
    const price = 60 + ((seed + i * 17) % 240);
    const rating = 6.5 + (((seed + i * 7) % 35) / 10);
    const id = `${provider}-${seed}-${i}`;
    out.push({
      provider,
      external_id: id,
      name: `${place.town} ${provider === "booking" ? "Stay" : "Resort"} #${(seed + i) % 500}`,
      town: place.town,
      county_code: place.county,
      country_code: "KE",
      latitude: null,
      longitude: null,
      image_url: MOCK_IMAGES[(seed + i) % MOCK_IMAGES.length],
      price_per_night: price,
      currency: "USD",
      rating: Math.round(rating * 10) / 10,
      review_count: 20 + ((seed + i * 13) % 480),
      deeplink_url:
        provider === "booking"
          ? `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(place.town)}`
          : `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(place.town)}`,
      raw: { mock: true, id, place },
    });
  }
  return out;
}

// ---------- Unified provider search (live or mock) ----------

export async function searchProvider(
  provider: ProviderId,
  input: SearchInput,
): Promise<{ mode: ProviderMode; rows: ExternalListing[] }> {
  const mode = getProviderMode(provider);
  if (mode === "disabled") return { mode, rows: [] };
  if (mode === "mock") return { mode, rows: mockResults(provider, input) };
  const rows =
    provider === "booking"
      ? await searchBookingComLive(input)
      : await searchExpediaLive(input);
  return { mode, rows };
}

// ---------- Cache upsert ----------

export async function upsertExternalListings(rows: ExternalListing[]) {
  if (rows.length === 0) return { count: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const payload = rows.map((r) => ({
    provider: r.provider,
    external_id: r.external_id,
    name: r.name,
    town: r.town,
    county_code: r.county_code,
    country_code: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    image_url: r.image_url,
    price_per_night: r.price_per_night,
    currency: r.currency,
    rating: r.rating,
    review_count: r.review_count,
    deeplink_url: r.deeplink_url,
    raw: r.raw as never,
    last_synced_at: new Date().toISOString(),
  }));
  const { error, count } = await supabaseAdmin
    .from("external_listings" as never)
    .upsert(payload as never, { onConflict: "provider,external_id", count: "exact" });
  if (error) throw new Error(`upsertExternalListings failed: ${error.message}`);
  return { count: count ?? rows.length };
}

// ---------- Sync runs logging ----------

export async function recordSyncRun(args: {
  provider: ProviderId;
  destination: string | null;
  mode: ProviderMode;
  status: "success" | "failed" | "skipped";
  itemsFound: number;
  itemsUpserted: number;
  errorMessage?: string | null;
  triggeredBy?: string | null;
  startedAt: Date;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("external_sync_runs" as never).insert({
    provider: args.provider,
    destination: args.destination,
    mode: args.mode === "disabled" ? "live" : args.mode,
    status: args.status,
    items_found: args.itemsFound,
    items_upserted: args.itemsUpserted,
    error_message: args.errorMessage ?? null,
    triggered_by: args.triggeredBy ?? null,
    started_at: args.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  } as never);
}

// ---------- High-level sync (per destination, both providers) ----------

export async function syncDestinations(args: {
  destinations: string[];
  perDestinationLimit?: number;
  triggeredBy?: string | null;
}) {
  const providers: ProviderId[] = ["booking", "expedia"];
  let totalUpserted = 0;
  const summary: Array<{
    provider: ProviderId;
    destination: string;
    mode: ProviderMode;
    status: "success" | "failed" | "skipped";
    itemsFound: number;
    itemsUpserted: number;
    error?: string;
  }> = [];
  for (const destination of args.destinations) {
    for (const provider of providers) {
      const startedAt = new Date();
      const mode = getProviderMode(provider);
      if (mode === "disabled") {
        summary.push({ provider, destination, mode, status: "skipped", itemsFound: 0, itemsUpserted: 0 });
        await recordSyncRun({
          provider, destination, mode, status: "skipped",
          itemsFound: 0, itemsUpserted: 0, triggeredBy: args.triggeredBy ?? null, startedAt,
        });
        continue;
      }
      try {
        const { rows } = await searchProvider(provider, {
          destination,
          limit: args.perDestinationLimit ?? 20,
        });
        const { count } = await upsertExternalListings(rows);
        totalUpserted += count;
        summary.push({ provider, destination, mode, status: "success", itemsFound: rows.length, itemsUpserted: count });
        await recordSyncRun({
          provider, destination, mode, status: "success",
          itemsFound: rows.length, itemsUpserted: count, triggeredBy: args.triggeredBy ?? null, startedAt,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.push({ provider, destination, mode, status: "failed", itemsFound: 0, itemsUpserted: 0, error: msg });
        await recordSyncRun({
          provider, destination, mode, status: "failed",
          itemsFound: 0, itemsUpserted: 0, errorMessage: msg, triggeredBy: args.triggeredBy ?? null, startedAt,
        });
      }
    }
  }
  return { totalUpserted, summary };
}
