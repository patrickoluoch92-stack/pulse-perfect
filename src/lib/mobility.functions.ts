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
  "self_drive", "chauffeur", "airport_transfer", "executive", "tour_van",
  "safari_4x4", "luxury", "wedding", "shuttle", "bus", "motorcycle", "bicycle", "boat",
] as const;
export type MobilityCategory = (typeof MOBILITY_CATEGORIES)[number];

export const MOBILITY_CATEGORY_LABELS: Record<MobilityCategory, string> = {
  self_drive: "Self-drive rentals",
  chauffeur: "Chauffeur-driven",
  airport_transfer: "Airport transfers",
  executive: "Executive transport",
  tour_van: "Tour vans",
  safari_4x4: "Safari 4x4",
  luxury: "Luxury cars",
  wedding: "Wedding vehicles",
  shuttle: "Shuttle services",
  bus: "Bus hire",
  motorcycle: "Motorcycle hire",
  bicycle: "Bicycle hire",
  boat: "Boat hire",
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
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
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
  pickupLocations: z.array(z.string()).max(20).optional(),
  dropoffLocations: z.array(z.string()).max(20).optional(),
  countyCode: z.string().max(10).optional(),
  town: z.string().max(80).optional(),
  description: z.string().max(4000).optional(),
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
      make: data.make,
      model: data.model,
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
      pickup_locations: data.pickupLocations ?? [],
      dropoff_locations: data.dropoffLocations ?? [],
      county_code: data.countyCode ?? null,
      town: data.town ?? null,
      description: data.description ?? null,
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
  .inputValidator((v: unknown) => z.object({ orgId: z.string().uuid().optional() }).parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    let q = sb.from("mobility_vehicles").select("*, mobility_providers(name, slug)")
      .order("created_at", { ascending: false });
    if (data.orgId) q = q.eq("org_id", data.orgId);
    const { data: rows } = await q;
    return { vehicles: rows ?? [] };
  });

export const getMyMobilityVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const [vehicle, rates, images, blocks] = await Promise.all([
      sb.from("mobility_vehicles").select("*").eq("id", data.id).maybeSingle(),
      sb.from("mobility_vehicle_rates").select("*").eq("vehicle_id", data.id).order("unit"),
      sb.from("mobility_vehicle_images").select("*").eq("vehicle_id", data.id).order("sort_order"),
      sb.from("mobility_availability_blocks").select("*").eq("vehicle_id", data.id).order("start_at"),
    ]);
    return {
      vehicle: vehicle.data,
      rates: rates.data ?? [],
      images: images.data ?? [],
      blocks: blocks.data ?? [],
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
  county: z.string().max(20).optional(),
  town: z.string().max(80).optional(),
  minSeats: z.number().int().optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  query: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const searchMobilityVehicles = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => SearchInput.parse(v ?? {}))
  .handler(async ({ data }) => {
    const sb = publicSb();
    let q = sb.from("mobility_vehicles")
      .select("id, slug, category, make, model, year, transmission, fuel_type, seats, luggage, has_ac, has_gps, county_code, town, description, rating_avg, rating_count, mobility_vehicle_images(url, alt, sort_order), mobility_vehicle_rates(unit, price_kes)")
      .eq("status", "approved")
      .order("is_featured", { ascending: false })
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.category) q = q.eq("category", data.category);
    if (data.county) q = q.eq("county_code", data.county);
    if (data.town) q = q.ilike("town", `%${data.town}%`);
    if (data.minSeats) q = q.gte("seats", data.minSeats);
    if (data.transmission) q = q.eq("transmission", data.transmission);
    if (data.query) q = q.or(`make.ilike.%${data.query}%,model.ilike.%${data.query}%,description.ilike.%${data.query}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { vehicles: rows ?? [] };
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
  driverOption: z.enum(["self", "chauffeur"]).default("self"),
  guestName: z.string().max(120).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});

export const createMobilityBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BookingInput.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as SB;
    const { data: v, error: vErr } = await sb.from("mobility_vehicles")
      .select("id, provider_id, org_id, mobility_vehicle_rates(unit, price_kes)")
      .eq("id", data.vehicleId).eq("status", "approved").maybeSingle();
    if (vErr || !v) throw new Error("Vehicle not available");

    const start = new Date(data.pickupAt).getTime();
    const end = new Date(data.dropoffAt).getTime();
    if (end <= start) throw new Error("Dropoff must be after pickup");
    const hours = Math.max(1, Math.ceil((end - start) / 3_600_000));
    const days = Math.ceil(hours / 24);
    const rates: Array<{ unit: string; price_kes: number }> = v.mobility_vehicle_rates ?? [];
    const dayRate = rates.find(r => r.unit === "day")?.price_kes ?? 0;
    const hourRate = rates.find(r => r.unit === "hour")?.price_kes ?? 0;
    const total = days >= 1 && dayRate ? Number(dayRate) * days : Number(hourRate) * hours;
    if (total <= 0) throw new Error("Vehicle has no configured pricing");

    const { data: booking, error } = await sb.from("mobility_bookings").insert({
      vehicle_id: v.id,
      provider_id: v.provider_id,
      org_id: v.org_id,
      guest_user_id: context.userId,
      guest_name: data.guestName ?? null,
      guest_email: data.guestEmail ?? null,
      guest_phone: data.guestPhone ?? null,
      pickup_at: data.pickupAt,
      dropoff_at: data.dropoffAt,
      pickup_location: data.pickupLocation ?? null,
      dropoff_location: data.dropoffLocation ?? null,
      driver_option: data.driverOption,
      total_kes: total,
      status: "pending",
      payment_status: "unpaid",
      notes: data.notes ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);

    // Reserve the calendar slot; if it collides, the exclusion constraint
    // will throw and we cancel the booking so it doesn't linger.
    const { error: blockErr } = await sb.from("mobility_availability_blocks").insert({
      vehicle_id: v.id,
      start_at: data.pickupAt,
      end_at: data.dropoffAt,
      reason: "booking",
      booking_id: booking.id,
    });
    if (blockErr) {
      await sb.from("mobility_bookings").update({ status: "cancelled" }).eq("id", booking.id);
      throw new Error("Vehicle is not available for the selected dates");
    }
    return { booking };
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
export async function fetchMobilityForPlan(query: string, county?: string, limit = 4) {
  const sb = publicSb();
  let q = sb.from("mobility_vehicles")
    .select("id, slug, category, make, model, seats, transmission, town, county_code, mobility_vehicle_rates(unit, price_kes)")
    .eq("status", "approved")
    .limit(limit * 2);
  if (county) q = q.ilike("county_code", `%${county}%`);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const scored = rows.map(r => ({
    ...r,
    _score: (
      (query.toLowerCase().includes(r.category) ? 3 : 0) +
      (query.toLowerCase().includes((r.make ?? "").toLowerCase()) ? 2 : 0) +
      (query.toLowerCase().includes((r.model ?? "").toLowerCase()) ? 2 : 0)
    ),
  }));
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}
