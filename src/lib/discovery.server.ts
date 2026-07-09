// Discovery crawler + AI extractor (server-only).
//
// Fetches a single seed URL, strips HTML → text, asks Lovable AI to extract
// candidate accommodation businesses as strict JSON, then upserts them into
// public.discovered_properties. Never touches Booking.com/Expedia/Airbnb/TripAdvisor.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeQualityScore } from "./discovery-score.server";
import { fingerprint, slugify } from "./discovery-dedupe.server";

const BLOCKED_HOSTS = [
  "booking.com",
  "expedia.com",
  "airbnb.com",
  "tripadvisor.com",
  "hotels.com",
  "agoda.com",
  "vrbo.com",
];

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5.5";

const EXTRACT_SCHEMA = {
  name: "accommodations",
  strict: false,
  schema: {
    type: "object",
    properties: {
      businesses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            property_type: { type: "string" },
            county_code: { type: "string" },
            town: { type: "string" },
            ward: { type: "string" },
            address: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" },
            phone: { type: "string" },
            email: { type: "string" },
            whatsapp: { type: "string" },
            website: { type: "string" },
            amenities: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            keywords: { type: "array", items: { type: "string" } },
            secondary_types: { type: "array", items: { type: "string" } },
            attributes: { type: "array", items: { type: "string" } },
            activities: { type: "array", items: { type: "string" } },
            nearby_parks: { type: "array", items: { type: "string" } },
            ai_description: { type: "string" },

            confidence: {
              type: "object",
              properties: {
                overall: { type: "number" },
              },
            },
          },
          required: ["name"],
        },
      },
    },
    required: ["businesses"],
  },
};

const SYSTEM_PROMPT = `You are an assistant that extracts Kenyan property & travel businesses from public directory text. Coverage includes accommodation, residential rentals, commercial space, agricultural property and land plots.

RULES:
- Only extract factual business/property information (name, type, location, contact, price) that appears in the source text.
- Never copy guest reviews, ratings, or copyrighted marketing descriptions verbatim.
- Write an ORIGINAL 1-2 sentence SEO-friendly description in your own words based only on factual details.
- Classify property_type (PRIMARY) as one of:
  # Accommodation & hospitality
  hotel, resort, lodge, guest_house, bnb, boutique_hotel, serviced_apartment, holiday_home, villa, hostel, cottage,
  camp, safari_camp, luxury_tented_camp, eco_lodge, campsite, glamping, mountain_lodge, beach_villa,
  lakefront_property, forest_retreat, conservancy, ranch,
  conference_centre, wedding_venue, corporate_retreat, team_building_venue, wellness_retreat,
  # Residential rentals & sales
  bedsitter, single_room, studio, one_bedroom, two_bedroom, three_bedroom, four_bedroom,
  apartment, flat, maisonette, townhouse, standalone_house, bungalow, duplex, penthouse,
  gated_community_home, student_hostel, staff_housing, senior_living,
  # Commercial
  office_space, shop, retail_space, warehouse, godown, industrial_building, business_park, coworking_space,
  hotel_for_sale, restaurant_lease,
  # Agricultural
  farm, agricultural_land, tea_farm, coffee_farm, flower_farm, dairy_farm, poultry_farm, fish_farm,
  # Land plots
  residential_plot, commercial_plot, industrial_plot, beach_plot, lakefront_plot, riverfront_plot,
  # Other
  tour_company, vacation_rental, unknown.
- Also return secondary_types[] with any additional categories from the same list that clearly apply.
- Return a hierarchical classification: parent_category_slug (e.g. "commercial-rental-houses") and child_category_slug (e.g. "1-bedroom", "bedsitter", "office-spaces"). Use "commercial-rental-houses" as the parent for any residential rental type OR office_space listing.
- Return listing_intent as one of: short_stay, rent, sale, lease (omit if unclear).
- When present, extract numeric fields: bedrooms, bathrooms, parking_spaces, land_size_acres, rent_monthly, rent_weekly, rent_daily, sale_price, security_deposit, service_charge, lease_period_months, available_from (YYYY-MM-DD), furnished (true/false), occupancy_status.
- Return attributes[] using ONLY these tokens when supported by the text:
  beachfront, lakefront, forest, mountain, family_friendly, pet_friendly, luxury, budget, eco_friendly, accessible, romantic, furnished, secure, gated, borehole, solar.
- Return activities[] using ONLY these tokens when clearly offered:
  wildlife_safari, horse_riding, bird_watching, nature_walks, hiking, camping, photography_safari, cultural_experience, farm_tour, adventure_activities, fishing, boat_excursion, kayaking, diving_snorkelling, cycling, yoga_wellness.
- Return nearby_parks[] with names of national parks / reserves / conservancies mentioned nearby.
- For Kenyan location, populate county_code (3-digit "001".."047"), constituency, ward, town, estate, neighbourhood when clearly stated.
- Return per-record confidence 0-1.
- Only return items that clearly represent a real, identifiable property or business. Skip advertisements, booking-site listings and duplicates.`;


function isHostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return !BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b));
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40000);
}

async function callAI(text: string): Promise<{ businesses: any[] }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract Kenyan accommodation businesses from this directory page:\n\n${text}` },
      ],
      response_format: { type: "json_schema", json_schema: EXTRACT_SCHEMA },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI extract failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { businesses: [] };
  }
}

export async function crawlSource(sourceId: string): Promise<{
  fetched: number;
  extracted: number;
  inserted: number;
  updated: number;
  error?: string;
}> {
  const runRes = await supabaseAdmin
    .from("discovery_runs")
    .insert({ source_id: sourceId, kind: "tick" })
    .select("id")
    .single();
  const runId = runRes.data?.id;

  try {
    const { data: source, error } = await supabaseAdmin
      .from("discovery_sources")
      .select("id, url, enabled, county_code")
      .eq("id", sourceId)
      .single();
    if (error || !source) throw new Error(error?.message ?? "source not found");
    if (!source.enabled) throw new Error("source disabled");
    if (!isHostAllowed(source.url)) throw new Error("host blocked");

    const resp = await fetch(source.url, {
      headers: { "User-Agent": "HostPulseDiscoveryBot/1.0 (+https://hostpulse-perfection.lovable.app)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`fetch ${source.url} → ${resp.status}`);
    const html = await resp.text();
    const text = stripHtml(html);
    if (text.length < 200) throw new Error("page too small to extract");

    const { businesses } = await callAI(text);
    let inserted = 0, updated = 0;

    for (const b of businesses ?? []) {
      if (!b?.name || typeof b.name !== "string") continue;
      const row = {
        source_id: source.id,
        source_url: source.url,
        name: b.name.trim().slice(0, 200),
        property_type: b.property_type ?? "unknown",
        county_code: b.county_code ?? source.county_code ?? null,
        town: b.town ?? null,
        ward: b.ward ?? null,
        address: b.address ?? null,
        latitude: typeof b.latitude === "number" ? b.latitude : null,
        longitude: typeof b.longitude === "number" ? b.longitude : null,
        phone: b.phone ?? null,
        email: b.email ?? null,
        whatsapp: b.whatsapp ?? null,
        website: b.website ?? null,
        amenities: Array.isArray(b.amenities) ? b.amenities.slice(0, 40) : [],
        tags: Array.isArray(b.tags) ? b.tags.slice(0, 20) : [],
        keywords: Array.isArray(b.keywords) ? b.keywords.slice(0, 20) : [],
        ai_description: b.ai_description ?? null,
        ai_confidence: b.confidence ?? {},
      };
      const fp = fingerprint(row);
      const quality = computeQualityScore(row);

      // Try to find existing by fingerprint
      const existing = await supabaseAdmin
        .from("discovered_properties")
        .select("id, status")
        .eq("dedupe_fingerprint", fp)
        .maybeSingle();

      if (existing.data) {
        await supabaseAdmin
          .from("discovered_properties")
          .update({ ...row, quality_score: quality, dedupe_fingerprint: fp })
          .eq("id", existing.data.id);
        updated++;
      } else {
        const slug = slugify(row.name, fp.slice(0, 6));
        await supabaseAdmin.from("discovered_properties").insert({
          ...row,
          slug,
          quality_score: quality,
          dedupe_fingerprint: fp,
        });
        inserted++;
      }
    }

    await supabaseAdmin
      .from("discovery_sources")
      .update({ last_crawled_at: new Date().toISOString() })
      .eq("id", source.id);

    if (runId) {
      await supabaseAdmin
        .from("discovery_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: true,
          stats: { fetched: 1, extracted: businesses?.length ?? 0, inserted, updated },
        })
        .eq("id", runId);
    }

    return { fetched: 1, extracted: businesses?.length ?? 0, inserted, updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) {
      await supabaseAdmin
        .from("discovery_runs")
        .update({ finished_at: new Date().toISOString(), ok: false, error: msg })
        .eq("id", runId);
    }
    return { fetched: 0, extracted: 0, inserted: 0, updated: 0, error: msg };
  }
}

/** Pick the least-recently-crawled enabled source and crawl it. */
export async function crawlNextSource(): Promise<{ sourceId: string | null; result?: any }> {
  const { data } = await supabaseAdmin
    .from("discovery_sources")
    .select("id")
    .eq("enabled", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (!data) return { sourceId: null };
  const result = await crawlSource(data.id);
  return { sourceId: data.id, result };
}

/** Nightly sweep: recompute quality scores + fingerprints (dedupe hint) for pending rows. */
export async function rescoreAllPending(): Promise<{ processed: number }> {
  const { data } = await supabaseAdmin
    .from("discovered_properties")
    .select("id, name, property_type, county_code, town, address, latitude, longitude, phone, email, website, amenities, ai_description, status, promoted_property_id")
    .in("status", ["pending", "approved", "claimed"])
    .limit(500);
  let processed = 0;
  for (const row of data ?? []) {
    const q = computeQualityScore(row as any);
    const fp = fingerprint(row as any);
    await supabaseAdmin
      .from("discovered_properties")
      .update({ quality_score: q, dedupe_fingerprint: fp })
      .eq("id", row.id);
    processed++;
  }
  return { processed };
}
