// Server-only helpers for pulling inbound inventory from Booking.com Demand API
// and Expedia EPS Rapid. Never import this file from client code or from a
// route module's top level — load it inside a server-function handler via:
//   const mod = await import("@/lib/external-inventory.server");

import type { Database } from "@/integrations/supabase/types";

export type ExternalListing = {
  provider: "booking" | "expedia";
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

// ---------- Booking.com Demand API ----------
// Docs: https://developers.booking.com/demand/docs/open-api
// Uses HTTP Basic auth with affiliate username + password.
const BOOKING_BASE = "https://demandapi.booking.com/3.1";

function bookingAuthHeader() {
  const u = process.env.BOOKING_COM_USERNAME;
  const p = process.env.BOOKING_COM_PASSWORD;
  if (!u || !p) throw new Error("Booking.com credentials missing");
  const token = Buffer.from(`${u}:${p}`).toString("base64");
  return `Basic ${token}`;
}

export async function searchBookingCom(input: SearchInput): Promise<ExternalListing[]> {
  if (!process.env.BOOKING_COM_USERNAME || !process.env.BOOKING_COM_PASSWORD) return [];
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
      product_price_breakdown?: {
        gross_amount_per_night?: { value?: number; currency?: string };
      };
      url?: string;
    }>;
  };
  return (json.data ?? []).map((row) => ({
    provider: "booking" as const,
    external_id: String(row.id),
    name: row.accommodation?.name ?? "Booking.com property",
    town: row.accommodation?.location?.city ?? null,
    county_code: null,
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
  }));
}

// ---------- Expedia EPS Rapid ----------
// Docs: https://developers.expediagroup.com/docs/rapid
// Requires HTTP basic auth with API key + shared secret.
const EXPEDIA_BASE = "https://api.ean.com/v3";

function expediaAuthHeader() {
  const key = process.env.EXPEDIA_RAPID_API_KEY;
  const secret = process.env.EXPEDIA_RAPID_SHARED_SECRET;
  if (!key || !secret) throw new Error("Expedia EPS credentials missing");
  const token = Buffer.from(`${key}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export async function searchExpedia(input: SearchInput): Promise<ExternalListing[]> {
  if (!process.env.EXPEDIA_RAPID_API_KEY || !process.env.EXPEDIA_RAPID_SHARED_SECRET) return [];
  // Region search by free text; EPS expects region_id for precise results — for a generic
  // destination string we fall back to "destination" geo-suggest. Tune once a region map exists.
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
  return Object.values(json).map((row) => ({
    provider: "expedia" as const,
    external_id: String(row.property_id ?? ""),
    name: row.name ?? "Expedia property",
    town: row.address?.city ?? null,
    county_code: null,
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
  }));
}

// ---------- Upsert into the cache table ----------
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
    raw: r.raw as Database["public"]["Tables"] extends { external_listings: { Row: infer R } }
      ? R extends { raw: infer J }
        ? J
        : unknown
      : unknown,
    last_synced_at: new Date().toISOString(),
  }));
  const { error, count } = await supabaseAdmin
    .from("external_listings" as never)
    .upsert(payload as never, { onConflict: "provider,external_id", count: "exact" });
  if (error) throw new Error(`upsertExternalListings failed: ${error.message}`);
  return { count: count ?? rows.length };
}
