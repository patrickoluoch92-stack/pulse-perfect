// HostPulse Mobility & Car Rental — server functions.
// Providers, vehicles, rates, images, availability, bookings, reviews.
// All mutations run under RLS via the authenticated Supabase client
// provided by requireSupabaseAuth. Public search uses a publishable client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Supabase types are regenerated after the migration is approved, so the new
// mobility_* tables aren't in the type file yet. We stay untyped here and rely
// on Zod for input validation + RLS for authorization.
type SB = any;

export const MOBILITY_CATEGORIES = [
  "self_drive", "chauffeur", "airport_transfer", "taxi", "shuttle",
  "executive", "luxury", "wedding", "safari_4x4", "tour_van", "camper",
  "bus", "motorcycle", "bicycle", "boat",
] as const;
export type MobilityCategory = (typeof MOBILITY_CATEGORIES)[number];

export const MOBILITY_CATEGORY_LABELS: Record<MobilityCategory, string> = {
  self_drive: "Self-drive rentals",
  chauffeur: "Chauffeur-driven",
  airport_transfer: "Airport transfers",
  taxi: "Taxi services",
  shuttle: "Shuttle services",
  executive: "Executive transport",
  luxury: "Luxury cars",
  wedding: "Wedding vehicles",
  safari_4x4: "Safari 4x4",
  tour_van: "Tour vans",
  camper: "Camper vans",
  bus: "Bus hire",
  motorcycle: "Motorcycle hire",
  bicycle: "Bicycle hire",
  boat: "Boat hire",
};

// Granular vehicle body/type classification (what the vehicle *is*),
// distinct from service categories above (how it's rented out).
export const MOBILITY_VEHICLE_TYPES = [
  "economy", "compact", "sedan", "hatchback", "station_wagon",
  "suv", "crossover", "4x4", "pickup", "van", "minivan", "passenger_van",
  "tour_van", "safari_land_cruiser", "luxury_sedan", "luxury_suv",
  "sports", "convertible", "limousine", "wedding_car",
  "electric", "hybrid", "camper", "bus", "motorcycle", "scooter", "bicycle", "boat",
] as const;
export type MobilityVehicleType = (typeof MOBILITY_VEHICLE_TYPES)[number];

export const MOBILITY_VEHICLE_TYPE_LABELS: Record<MobilityVehicleType, string> = {
  economy: "Economy", compact: "Compact", sedan: "Sedan", hatchback: "Hatchback",
  station_wagon: "Station wagon", suv: "SUV", crossover: "Crossover", "4x4": "4x4",
  pickup: "Pickup truck", van: "Van", minivan: "Minivan", passenger_van: "Passenger van",
  tour_van: "Tour van", safari_land_cruiser: "Safari Land Cruiser",
  luxury_sedan: "Luxury sedan", luxury_suv: "Luxury SUV", sports: "Sports car",
  convertible: "Convertible", limousine: "Limousine", wedding_car: "Wedding car",
  electric: "Electric", hybrid: "Hybrid", camper: "Camper van",
  bus: "Bus", motorcycle: "Motorcycle", scooter: "Scooter", bicycle: "Bicycle", boat: "Boat",
};


function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function publicSb(): SB {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- PROVIDER ----------
const ProviderInput = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  name: z.string().min(2).max(120),
  bio: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  website: z.string().url().optional(),
  serviceAreas: z.array(z.string()).max(50).optional(),
  serviceCategories: z.array(z.enum(MOBILITY_CATEGORIES)).max(MOBILITY_CATEGORIES.length).optional(),
  businessRegNumber: z.string().max(80).optional(),
  licenseNumber: z.string().max(80).optional(),
  taxPin: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  operatingHours: z.record(z.string(), z.any()).optional(),
  emergencyContact: z.string().max(80).optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  policies: z.string().max(6000).optional(),
  terms: z.string().max(6000).optional(),
  coverImageUrl: z.string().url().optional(),
  verificationDocs: z.array(z.object({
    label: z.string().max(120),
    url: z.string().url(),
  })).max(20).optional(),
});

export const upsertMobilityProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ProviderInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const payload: Record<string, unknown> = {
      org_id: data.orgId,
      name: data.name,
      bio: data.bio ?? null,
      logo_url: data.logoUrl ?? null,
      contact_email: data.contactEmail ?? null,
      contact_phone: data.contactPhone ?? null,
      website: data.website ?? null,
      service_areas: data.serviceAreas ?? [],
      service_categories: data.serviceCategories ?? [],
      business_reg_number: data.businessRegNumber ?? null,
      license_number: data.licenseNumber ?? null,
      tax_pin: data.taxPin ?? null,
      address: data.address ?? null,
      county_code: data.countyCode ?? null,
      town: data.town ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      operating_hours: data.operatingHours ?? {},
      emergency_contact: data.emergencyContact ?? null,
      social_links: data.socialLinks ?? {},
      policies: data.policies ?? null,
      terms: data.terms ?? null,
      verification_docs: data.verificationDocs ?? [],
      cover_image_url: data.coverImageUrl ?? null,
    };
    if (data.id) {
      const { data: row, error } = await sb.from("mobility_providers")
        .update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return { provider: row };
    }
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await sb.from("mobility_providers")
      .insert({ ...payload, slug }).select("*").single();
    if (error) throw new Error(error.message);
    return { provider: row };
  });

export const listMyMobilityProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as SB;
    const { data } = await sb.from("mobility_providers")
      .select("*").order("created_at", { ascending: false });
    return { providers: data ?? [] };
  });

export const submitMobilityProviderForVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_providers")
      .update({ verification_status: "pending" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- VEHICLE ----------
const VehicleInput = z.object({
  id: z.string().uuid().optional(),
  providerId: z.string().uuid(),
  orgId: z.string().uuid(),
  category: z.enum(MOBILITY_CATEGORIES),
  vehicleType: z.enum(MOBILITY_VEHICLE_TYPES).optional(),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  trim: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  fuelType: z.string().max(30).optional(),
  seats: z.number().int().min(1).max(80).optional(),
  luggage: z.number().int().min(0).max(30).optional(),
  hasAc: z.boolean().optional(),
  hasGps: z.boolean().optional(),
  hasBluetooth: z.boolean().optional(),
  hasChildSeat: z.boolean().optional(),
  driveType: z.enum(["2wd", "4wd", "awd"]).optional(),
  engineSize: z.string().max(20).optional(),
  doors: z.number().int().min(1).max(8).optional(),
  features: z.array(z.string().max(60)).max(30).optional(),
  accessibility: z.array(z.string().max(60)).max(10).optional(),
  mileagePolicy: z.string().max(400).optional(),
  minDriverAge: z.number().int().min(16).max(80).optional(),
  licenseRequirements: z.string().max(400).optional(),
  fuelPolicy: z.string().max(400).optional(),
  registrationPlate: z.string().max(20).optional(),
  mainImageUrl: z.string().url().optional(),
  insuranceInfo: z.record(z.string(), z.any()).optional(),
  securityDepositKes: z.number().nonnegative().optional(),
  promoPriceKes: z.number().nonnegative().optional(),
  pickupLocations: z.array(z.string()).max(20).optional(),
  dropoffLocations: z.array(z.string()).max(20).optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  description: z.string().max(4000).optional(),
  isLuxury: z.boolean().optional(),
  isElectric: z.boolean().optional(),
  isHybrid: z.boolean().optional(),
  isWedding: z.boolean().optional(),
  isSafari: z.boolean().optional(),
  instantBook: z.boolean().optional(),
});

export const upsertMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => VehicleInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const payload: Record<string, unknown> = {
      provider_id: data.providerId,
      org_id: data.orgId,
      category: data.category,
      vehicle_type: data.vehicleType ?? null,
      make: data.make,
      model: data.model,
      trim: data.trim ?? null,
      color: data.color ?? null,
      year: data.year ?? null,
      transmission: data.transmission ?? null,
      fuel_type: data.fuelType ?? null,
      seats: data.seats ?? null,
      luggage: data.luggage ?? null,
      has_ac: data.hasAc ?? false,
      has_gps: data.hasGps ?? false,
      has_bluetooth: data.hasBluetooth ?? false,
      has_child_seat: data.hasChildSeat ?? false,
      drive_type: data.driveType ?? null,
      engine_size: data.engineSize ?? null,
      doors: data.doors ?? null,
      features: data.features ?? [],
      accessibility: data.accessibility ?? [],
      mileage_policy: data.mileagePolicy ?? null,
      min_driver_age: data.minDriverAge ?? null,
      license_requirements: data.licenseRequirements ?? null,
      fuel_policy: data.fuelPolicy ?? null,
      registration_plate: data.registrationPlate ?? null,
      main_image_url: data.mainImageUrl ?? null,
      insurance_info: data.insuranceInfo ?? {},
      security_deposit_kes: data.securityDepositKes ?? null,
      promo_price_kes: data.promoPriceKes ?? null,
      pickup_locations: data.pickupLocations ?? [],
      dropoff_locations: data.dropoffLocations ?? [],
      county_code: data.countyCode ?? null,
      town: data.town ?? null,
      description: data.description ?? null,
      is_luxury: data.isLuxury ?? false,
      is_electric: data.isElectric ?? false,
      is_hybrid: data.isHybrid ?? false,
      is_wedding: data.isWedding ?? false,
      is_safari: data.isSafari ?? false,
      instant_book: data.instantBook ?? false,
    };
    if (data.id) {
      const { data: row, error } = await sb.from("mobility_vehicles")
        .update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return { vehicle: row };
    }
    const slug = `${slugify(`${data.make}-${data.model}-${data.year ?? ""}`)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await sb.from("mobility_vehicles")
      .insert({ ...payload, slug, status: "draft" }).select("*").single();
    if (error) throw new Error(error.message);
    return { vehicle: row };
  });

export const submitMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_vehicles")
      .update({ status: "pending" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyMobilityVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    orgId: z.string().uuid().optional(),
    includeArchived: z.boolean().default(false),
  }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    let q = sb.from("mobility_vehicles").select("*, mobility_providers(name, slug)")
      .order("created_at", { ascending: false });
    if (data.orgId) q = q.eq("org_id", data.orgId);
    if (!data.includeArchived) q = q.eq("is_archived", false);
    const { data: rows } = await q;
    return { vehicles: rows ?? [] };
  });

export const archiveMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(), archived: z.boolean().default(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_vehicles").update({
      is_archived: data.archived,
      archived_at: data.archived ? new Date().toISOString() : null,
      status: data.archived ? "archived" : "draft",
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getMyMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const [vehicle, rates, images, blocks, seasonal] = await Promise.all([
      sb.from("mobility_vehicles").select("*").eq("id", data.id).maybeSingle(),
      sb.from("mobility_vehicle_rates").select("*").eq("vehicle_id", data.id).order("unit"),
      sb.from("mobility_vehicle_images").select("*").eq("vehicle_id", data.id).order("sort_order"),
      sb.from("mobility_availability_blocks").select("*").eq("vehicle_id", data.id).order("start_at"),
      sb.from("mobility_seasonal_rates").select("*").eq("vehicle_id", data.id).order("starts_on"),
    ]);
    return {
      vehicle: vehicle.data,
      rates: rates.data ?? [],
      images: images.data ?? [],
      blocks: blocks.data ?? [],
      seasonalRates: seasonal.data ?? [],
    };
  });

// ---------- RATES ----------
const RatesInput = z.object({
  vehicleId: z.string().uuid(),
  rates: z.array(z.object({
    unit: z.enum(["hour", "day", "week", "month"]),
    priceKes: z.number().nonnegative(),
    minUnits: z.number().int().min(1).default(1),
    includedKm: z.number().int().min(0).optional(),
    extraKmKes: z.number().min(0).optional(),
  })).max(4),
});

export const setMobilityVehicleRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RatesInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    // Upsert per unit
    for (const r of data.rates) {
      const { error } = await sb.from("mobility_vehicle_rates").upsert({
        vehicle_id: data.vehicleId,
        unit: r.unit,
        price_kes: r.priceKes,
        min_units: r.minUnits,
        included_km: r.includedKm ?? null,
        extra_km_kes: r.extraKmKes ?? null,
      }, { onConflict: "vehicle_id,unit" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- SEASONAL / PROMOTIONAL RATES ----------
const SeasonalRateInput = z.object({
  vehicleId: z.string().uuid(),
  label: z.string().min(1).max(120),
  startsOn: z.string(),
  endsOn: z.string(),
  unit: z.enum(["hour", "day", "week", "month"]),
  priceKes: z.number().nonnegative(),
  promoCode: z.string().max(40).optional(),
});

export const upsertMobilitySeasonalRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SeasonalRateInput.extend({ id: z.string().uuid().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const payload = {
      vehicle_id: data.vehicleId,
      label: data.label,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      unit: data.unit,
      price_kes: data.priceKes,
      promo_code: data.promoCode ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("mobility_seasonal_rates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("mobility_seasonal_rates").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMobilitySeasonalRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    await sb.from("mobility_seasonal_rates").delete().eq("id", data.id);
    return { ok: true };
  });



// ---------- IMAGES ----------
export const addMobilityVehicleImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    vehicleId: z.string().uuid(),
    url: z.string().url(),
    alt: z.string().max(200).optional(),
    sortOrder: z.number().int().min(0).default(0),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { data: row, error } = await sb.from("mobility_vehicle_images")
      .insert({ vehicle_id: data.vehicleId, url: data.url, alt: data.alt ?? null, sort_order: data.sortOrder })
      .select("*").single();
    if (error) throw new Error(error.message);
    return { image: row };
  });

export const deleteMobilityVehicleImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    await sb.from("mobility_vehicle_images").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- AVAILABILITY ----------
export const blockMobilityDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    vehicleId: z.string().uuid(),
    startAt: z.string(),
    endAt: z.string(),
    reason: z.string().max(200).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_availability_blocks").insert({
      vehicle_id: data.vehicleId,
      start_at: data.startAt,
      end_at: data.endAt,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unblockMobilityDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    await sb.from("mobility_availability_blocks").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- PUBLIC SEARCH ----------
const SearchInput = z.object({
  category: z.enum(MOBILITY_CATEGORIES).optional(),
  vehicleType: z.enum(MOBILITY_VEHICLE_TYPES).optional(),
  make: z.string().max(60).optional(),
  county: z.string().max(20).optional(),
  town: z.string().max(80).optional(),
  minSeats: z.number().int().optional(),
  minLuggage: z.number().int().optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  fuelType: z.string().max(30).optional(),
  driveType: z.enum(["2wd", "4wd", "awd"]).optional(),
  hasAc: z.boolean().optional(),
  hasGps: z.boolean().optional(),
  isLuxury: z.boolean().optional(),
  isElectric: z.boolean().optional(),
  isHybrid: z.boolean().optional(),
  isWedding: z.boolean().optional(),
  isSafari: z.boolean().optional(),
  instantBook: z.boolean().optional(),
  priceMaxKes: z.number().nonnegative().optional(),
  query: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const searchMobilityVehicles = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => SearchInput.parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = publicSb();
    let q = sb.from("mobility_vehicles")
      .select("id, slug, category, vehicle_type, make, model, trim, color, year, transmission, fuel_type, drive_type, seats, luggage, has_ac, has_gps, is_luxury, is_electric, is_hybrid, is_wedding, is_safari, instant_book, promo_price_kes, county_code, town, description, rating_avg, rating_count, mobility_vehicle_images(url, alt, sort_order), mobility_vehicle_rates(unit, price_kes)")
      .eq("status", "approved")
      .order("is_featured", { ascending: false })
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.category) q = q.eq("category", data.category);
    if (data.vehicleType) q = q.eq("vehicle_type", data.vehicleType);
    if (data.make) q = q.ilike("make", `%${data.make}%`);
    if (data.county) q = q.eq("county_code", data.county);
    if (data.town) q = q.ilike("town", `%${data.town}%`);
    if (data.minSeats) q = q.gte("seats", data.minSeats);
    if (data.minLuggage) q = q.gte("luggage", data.minLuggage);
    if (data.transmission) q = q.eq("transmission", data.transmission);
    if (data.fuelType) q = q.eq("fuel_type", data.fuelType);
    if (data.driveType) q = q.eq("drive_type", data.driveType);
    if (data.hasAc) q = q.eq("has_ac", true);
    if (data.hasGps) q = q.eq("has_gps", true);
    if (data.isLuxury) q = q.eq("is_luxury", true);
    if (data.isElectric) q = q.eq("is_electric", true);
    if (data.isHybrid) q = q.eq("is_hybrid", true);
    if (data.isWedding) q = q.eq("is_wedding", true);
    if (data.isSafari) q = q.eq("is_safari", true);
    if (data.instantBook) q = q.eq("instant_book", true);
    if (data.query) {
      const { sanitizePostgrestTerm } = await import("@/lib/safe-fetch");
      const clean = sanitizePostgrestTerm(data.query);
      if (clean) q = q.or(`make.ilike.%${clean}%,model.ilike.%${clean}%,description.ilike.%${clean}%`);
    }
    let { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let vehicles = rows ?? [];
    if (data.priceMaxKes) {
      vehicles = vehicles.filter((v: any) => {
        const rates = (v.mobility_vehicle_rates ?? []) as Array<{ unit: string; price_kes: number }>;
        const daily = rates.find(r => r.unit === "day")?.price_kes;
        return daily != null && Number(daily) <= data.priceMaxKes!;
      });
    }
    return { vehicles };
  });


export const getPublicMobilityVehicle = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ slug: z.string() }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicSb();
    const { data: v } = await sb.from("mobility_vehicles")
      .select("*, mobility_providers(id, name, slug, bio, logo_url, rating_avg, rating_count), mobility_vehicle_images(url, alt, sort_order), mobility_vehicle_rates(unit, price_kes, min_units, included_km, extra_km_kes)")
      .eq("slug", data.slug).eq("status", "approved").maybeSingle();
    return { vehicle: v };
  });

// ---------- BOOKINGS ----------
const BookingInput = z.object({
  vehicleId: z.string().uuid(),
  pickupAt: z.string(),
  dropoffAt: z.string(),
  pickupLocation: z.string().max(200).optional(),
  dropoffLocation: z.string().max(200).optional(),
  deliveryAddress: z.string().max(300).optional(),
  driverOption: z.enum(["self", "chauffeur"]).default("self"),
  guestName: z.string().max(120).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  extensionOf: z.string().uuid().optional(),
});

const QuoteInput = z.object({
  vehicleId: z.string().uuid(),
  pickupAt: z.string(),
  dropoffAt: z.string(),
  driverOption: z.enum(["self", "chauffeur"]).default("self"),
});

// Shared pricing engine — uses base rates, seasonal overrides, and pricing tiers.
// Returns a full breakdown for the quote endpoint and the create endpoint.
async function computeMobilityQuote(sb: SB, params: {
  vehicleId: string; pickupAt: string; dropoffAt: string; driverOption: "self" | "chauffeur";
}) {
  const { data: v, error: vErr } = await sb.from("mobility_vehicles")
    .select("id, provider_id, org_id, security_deposit_kes, promo_price_kes, mobility_vehicle_rates(unit, price_kes, min_units)")
    .eq("id", params.vehicleId).eq("status", "approved").maybeSingle();
  if (vErr || !v) throw new Error("Vehicle not available");

  const start = new Date(params.pickupAt).getTime();
  const end = new Date(params.dropoffAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Dropoff must be after pickup");
  }
  const hours = Math.max(1, Math.ceil((end - start) / 3_600_000));
  const days = Math.ceil(hours / 24);
  const rates: Array<{ unit: string; price_kes: number; min_units?: number }> = v.mobility_vehicle_rates ?? [];
  const baseDay = Number(rates.find(r => r.unit === "day")?.price_kes ?? 0);
  const baseHour = Number(rates.find(r => r.unit === "hour")?.price_kes ?? 0);
  const baseWeek = Number(rates.find(r => r.unit === "week")?.price_kes ?? 0);
  const baseMonth = Number(rates.find(r => r.unit === "month")?.price_kes ?? 0);

  // Seasonal override
  const pickupDate = new Date(params.pickupAt).toISOString().slice(0, 10);
  const { data: seasonal } = await sb.from("mobility_seasonal_rates")
    .select("unit, price_kes, starts_on, ends_on, label")
    .eq("vehicle_id", params.vehicleId)
    .lte("starts_on", pickupDate).gte("ends_on", pickupDate);
  const seasonalDay = Number((seasonal ?? []).find((s: any) => s.unit === "day")?.price_kes ?? 0);
  const seasonalHour = Number((seasonal ?? []).find((s: any) => s.unit === "hour")?.price_kes ?? 0);

  // Duration-based pricing tiers (weekly/monthly discounts)
  const { data: tiers } = await sb.from("mobility_pricing_tiers")
    .select("tier, price_kes, min_units, starts_on, ends_on, is_active")
    .eq("vehicle_id", params.vehicleId).eq("is_active", true);
  const applicableTiers = (tiers ?? []).filter((t: any) =>
    (!t.starts_on || t.starts_on <= pickupDate) && (!t.ends_on || t.ends_on >= pickupDate)
  );
  // Best (cheapest per-day-equivalent) tier for the duration
  let tierDaily = 0;
  let tierLabel: string | null = null;
  for (const t of applicableTiers) {
    const minUnits = Number(t.min_units ?? 1);
    if (days < minUnits) continue;
    const perDay = Number(t.price_kes ?? 0) / minUnits;
    if (perDay > 0 && (tierDaily === 0 || perDay < tierDaily)) {
      tierDaily = perDay;
      tierLabel = String(t.tier);
    }
  }

  // Pick daily rate: prefer promo → seasonal → tier → base
  const promoDay = Number(v.promo_price_kes ?? 0);
  let dailyRate = baseDay;
  let dailySource = "base";
  if (promoDay > 0 && (dailyRate === 0 || promoDay < dailyRate)) { dailyRate = promoDay; dailySource = "promo"; }
  if (seasonalDay > 0 && seasonalDay < dailyRate) { dailyRate = seasonalDay; dailySource = "seasonal"; }
  if (tierDaily > 0 && tierDaily < dailyRate) { dailyRate = tierDaily; dailySource = tierLabel ? `tier:${tierLabel}` : "tier"; }

  const hourlyRate = seasonalHour > 0 ? seasonalHour : baseHour;

  let subtotal = 0;
  let unit: "day" | "hour" = "day";
  if (days >= 1 && dailyRate > 0) {
    subtotal = dailyRate * days;
    unit = "day";
    // long stays: prefer weekly / monthly base if cheaper
    if (baseWeek > 0 && days >= 7 && baseWeek * Math.ceil(days / 7) < subtotal) {
      subtotal = baseWeek * Math.ceil(days / 7);
      dailySource = "weekly";
    }
    if (baseMonth > 0 && days >= 30 && baseMonth * Math.ceil(days / 30) < subtotal) {
      subtotal = baseMonth * Math.ceil(days / 30);
      dailySource = "monthly";
    }
  } else if (hourlyRate > 0) {
    subtotal = hourlyRate * hours;
    unit = "hour";
  }
  if (subtotal <= 0) throw new Error("Vehicle has no configured pricing");

  const chauffeurFee = params.driverOption === "chauffeur" ? Math.round(subtotal * 0.25) : 0;
  const deposit = Number(v.security_deposit_kes ?? 0);
  const total = subtotal + chauffeurFee;

  return {
    vehicle: { id: v.id, provider_id: v.provider_id, org_id: v.org_id },
    duration: { hours, days, unit },
    breakdown: {
      dailyRate: unit === "day" ? Math.round(subtotal / days) : hourlyRate,
      dailySource,
      subtotalKes: subtotal,
      chauffeurFeeKes: chauffeurFee,
      depositKes: deposit,
      totalKes: total,
    },
  };
}

export const quoteMobilityBooking = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => QuoteInput.parse(v))
  .handler(async ({ data }) => {
    // Public endpoint — use publishable client (RLS still applies via anon-safe SELECT policies).
    const sb = publicSb();
    const q = await computeMobilityQuote(sb, data);
    return { quote: q.breakdown, duration: q.duration };
  });

export const createMobilityBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BookingInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const q = await computeMobilityQuote(sb, {
      vehicleId: data.vehicleId,
      pickupAt: data.pickupAt,
      dropoffAt: data.dropoffAt,
      driverOption: data.driverOption,
    });

    const { data: booking, error } = await sb.from("mobility_bookings").insert({
      vehicle_id: q.vehicle.id,
      provider_id: q.vehicle.provider_id,
      org_id: q.vehicle.org_id,
      guest_user_id: context.userId,
      guest_name: data.guestName ?? null,
      guest_email: data.guestEmail ?? null,
      guest_phone: data.guestPhone ?? null,
      pickup_at: data.pickupAt,
      dropoff_at: data.dropoffAt,
      pickup_location: data.pickupLocation ?? null,
      dropoff_location: data.dropoffLocation ?? null,
      delivery_address: data.deliveryAddress ?? null,
      driver_option: data.driverOption,
      total_kes: q.breakdown.totalKes,
      deposit_kes: q.breakdown.depositKes,
      status: "pending",
      payment_status: "unpaid",
      notes: data.notes ?? null,
      extension_of: data.extensionOf ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);

    // Reserve the calendar slot; if it collides, the exclusion constraint
    // will throw and we cancel the booking so it doesn't linger.
    const { error: blockErr } = await sb.from("mobility_availability_blocks").insert({
      vehicle_id: q.vehicle.id,
      start_at: data.pickupAt,
      end_at: data.dropoffAt,
      reason: "booking",
      booking_id: booking.id,
    });
    if (blockErr) {
      await sb.from("mobility_bookings").update({ status: "cancelled" }).eq("id", booking.id);
      throw new Error("Vehicle is not available for the selected dates");
    }
    return { booking, breakdown: q.breakdown };
  });

export const listMyMobilityBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as SB;
    const { data } = await sb.from("mobility_bookings")
      .select("*, mobility_vehicles(make, model, slug), mobility_providers(name, slug)")
      .order("pickup_at", { ascending: false })
      .limit(50);
    return { bookings: data ?? [] };
  });

// ---------- ANALYTICS ----------
export const getMobilityProviderAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ orgId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const [{ data: bookings }, { data: vehicles }] = await Promise.all([
      sb.from("mobility_bookings").select("total_kes, status, pickup_at")
        .eq("org_id", data.orgId).gte("pickup_at", new Date(Date.now() - 90 * 86400000).toISOString()),
      sb.from("mobility_vehicles").select("id, status").eq("org_id", data.orgId),
    ]);
    const list = bookings ?? [];
    const revenue = list.filter((b: any) => b.status !== "cancelled").reduce((s: number, b: any) => s + Number(b.total_kes ?? 0), 0);
    return {
      revenueKes: revenue,
      bookingsCount: list.length,
      activeVehicles: (vehicles ?? []).filter((x: any) => x.status === "approved").length,
      totalVehicles: (vehicles ?? []).length,
    };
  });

// ---------- MOBILITY GROUNDING (for Planner AI) ----------
export async function fetchMobilityForPlan(
  query: string,
  opts?: { county?: string; travellers?: number; luggage?: number; purpose?: string; budgetKesPerDay?: number; limit?: number },
) {
  const { county, travellers, luggage, purpose, budgetKesPerDay, limit = 4 } = opts ?? {};
  const sb = publicSb();
  let q = sb.from("mobility_vehicles")
    .select("id, slug, category, vehicle_type, make, model, seats, luggage, transmission, drive_type, is_luxury, is_safari, is_wedding, is_electric, is_hybrid, town, county_code, mobility_vehicle_rates(unit, price_kes)")
    .eq("status", "approved")
    .limit(limit * 4);
  if (county) q = q.ilike("county_code", `%${county}%`);
  if (travellers) q = q.gte("seats", travellers);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const q_l = query.toLowerCase();
  const p_l = (purpose ?? "").toLowerCase();
  const scored = rows.map(r => {
    const rates: Array<{ unit: string; price_kes: number }> = r.mobility_vehicle_rates ?? [];
    const daily = Number(rates.find(x => x.unit === "day")?.price_kes ?? 0);
    let score = 0;
    if (q_l.includes(r.category)) score += 3;
    if (r.make && q_l.includes(String(r.make).toLowerCase())) score += 2;
    if (r.model && q_l.includes(String(r.model).toLowerCase())) score += 2;
    if (luggage && r.luggage && r.luggage >= luggage) score += 1;
    if (p_l.includes("safari") && r.is_safari) score += 4;
    if (p_l.includes("wedding") && r.is_wedding) score += 4;
    if ((p_l.includes("luxury") || p_l.includes("executive")) && r.is_luxury) score += 3;
    if ((p_l.includes("eco") || p_l.includes("green")) && (r.is_electric || r.is_hybrid)) score += 2;
    if (budgetKesPerDay && daily && daily <= budgetKesPerDay) score += 2;
    if (budgetKesPerDay && daily && daily > budgetKesPerDay) score -= 2;
    return { ...r, _score: score };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}


// ---------- BOOKING MANAGEMENT (provider side) ----------
export const listMobilityProviderBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    orgId: z.string().uuid(),
    vehicleId: z.string().uuid().optional(),
    status: z.string().max(30).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    let q = sb.from("mobility_bookings")
      .select("*, mobility_vehicles(make, model, slug)")
      .eq("org_id", data.orgId)
      .order("pickup_at", { ascending: false })
      .limit(100);
    if (data.vehicleId) q = q.eq("vehicle_id", data.vehicleId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { bookings: rows ?? [] };
  });

export const respondMobilityBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["confirmed", "declined", "cancelled", "completed"]),
    message: z.string().max(2000).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const patch: Record<string, unknown> = {
      status: data.status,
      provider_response: data.message ?? null,
      provider_responded_at: new Date().toISOString(),
    };
    const { error } = await sb.from("mobility_bookings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "declined" || data.status === "cancelled") {
      await sb.from("mobility_availability_blocks").delete().eq("booking_id", data.id);
    }
    return { ok: true };
  });

// ---------- REVIEWS ----------
export const listMobilityProviderReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    orgId: z.string().uuid(),
    vehicleId: z.string().uuid().optional(),
    status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    // mobility_reviews has provider_id (not org_id) — resolve providers under this org.
    const { data: providers } = await sb.from("mobility_providers").select("id").eq("org_id", data.orgId);
    const providerIds = (providers ?? []).map((p: any) => p.id);
    if (providerIds.length === 0) return { reviews: [] };

    let q = sb.from("mobility_reviews")
      .select("*, mobility_vehicles(make, model, slug)")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.vehicleId) q = q.eq("vehicle_id", data.vehicleId);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { reviews: rows ?? [] };
  });

export const respondMobilityReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(),
    response: z.string().min(1).max(2000),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_reviews").update({
      response: data.response,
      responded_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Provider approves or rejects a pending review before it goes public.
export const moderateMobilityReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
    reason: z.string().max(500).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { error } = await sb.from("mobility_reviews").update({
      status: data.action === "approve" ? "approved" : "rejected",
      moderated_at: new Date().toISOString(),
      moderated_by: context.userId,
      moderation_reason: data.reason ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PUBLIC COMPANY DIRECTORY ----------
export const listPublicMobilityProviders = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({
    query: z.string().max(120).optional(),
    county: z.string().max(20).optional(),
    category: z.enum(MOBILITY_CATEGORIES).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).default(0),
  }).parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = publicSb();
    let q = sb.from("mobility_providers")
      .select("id, slug, name, bio, logo_url, cover_image_url, town, county_code, rating_avg, rating_count, service_categories, verification_status")
      .eq("verification_status", "verified")
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.query) {
      const { sanitizePostgrestTerm } = await import("@/lib/safe-fetch");
      const clean = sanitizePostgrestTerm(data.query);
      if (clean) q = q.or(`name.ilike.%${clean}%,bio.ilike.%${clean}%`);
    }
    if (data.county) q = q.eq("county_code", data.county);
    if (data.category) q = q.contains("service_categories", [data.category]);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { providers: rows ?? [] };
  });

export const getPublicMobilityProvider = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ slug: z.string().max(120) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicSb();
    const { data: provider } = await sb.from("mobility_providers")
      .select("id, slug, name, bio, logo_url, cover_image_url, website, contact_email, contact_phone, address, town, county_code, service_categories, service_areas, operating_hours, policies, terms, rating_avg, rating_count, verification_status")
      .eq("slug", data.slug)
      .eq("verification_status", "verified")
      .maybeSingle();
    if (!provider) return { provider: null, vehicles: [] };
    const { data: vehicles } = await sb.from("mobility_vehicles")
      .select("id, slug, category, vehicle_type, make, model, year, seats, transmission, town, main_image_url, rating_avg, rating_count, mobility_vehicle_rates(unit, price_kes)")
      .eq("provider_id", provider.id)
      .eq("status", "approved")
      .eq("is_archived", false)
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .limit(60);
    return { provider, vehicles: vehicles ?? [] };
  });

// ---------- PUBLIC VEHICLE REVIEWS ----------
export const listPublicVehicleReviews = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({
    vehicleId: z.string().uuid(),
    limit: z.number().int().min(1).max(50).default(20),
  }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicSb();
    const { data: rows, error } = await sb.from("mobility_reviews")
      .select("id, rating, comment, response, responded_at, created_at")
      .eq("vehicle_id", data.vehicleId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { reviews: rows ?? [] };
  });

// Guest submits a review. Must have a completed booking for the vehicle.
export const submitMobilityReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    vehicleId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    // Verify the caller has at least one completed booking on this vehicle.
    const { data: booking } = await sb.from("mobility_bookings")
      .select("id, provider_id")
      .eq("vehicle_id", data.vehicleId)
      .eq("guest_user_id", context.userId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (!booking) throw new Error("You can only review a vehicle after a completed booking.");

    // One review per author per vehicle: update if already exists.
    const { data: existing } = await sb.from("mobility_reviews")
      .select("id")
      .eq("vehicle_id", data.vehicleId)
      .eq("author_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await sb.from("mobility_reviews").update({
        rating: data.rating,
        comment: data.comment ?? null,
        status: "pending",
      }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id, updated: true };
    }

    const { data: row, error } = await sb.from("mobility_reviews").insert({
      vehicle_id: data.vehicleId,
      provider_id: booking.provider_id,
      author_id: context.userId,
      rating: data.rating,
      comment: data.comment ?? null,
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id, updated: false };
  });

// Whether the current user is eligible to review a given vehicle
// (has a completed booking on it) plus any existing review.
export const getMyMobilityReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { data: booking } = await sb.from("mobility_bookings")
      .select("id")
      .eq("vehicle_id", data.vehicleId)
      .eq("guest_user_id", context.userId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    const { data: mine } = await sb.from("mobility_reviews")
      .select("id, rating, comment, status, response, created_at")
      .eq("vehicle_id", data.vehicleId)
      .eq("author_id", context.userId)
      .maybeSingle();
    return { eligible: !!booking, review: mine ?? null };
  });
