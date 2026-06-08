import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- shared schemas -----
const orgIdSchema = z.object({ orgId: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });

const cents = z.number().int().min(0).max(100_000_000);
const currency = z.string().trim().length(3).regex(/^[A-Z]{3}$/);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

function nullEmpty<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = { ...o };
  for (const k of Object.keys(out)) if (out[k] === "") out[k] = null;
  return out as T;
}

// ============================================================
// Packages
// ============================================================
const packageBase = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  durationDays: z.number().int().min(1).max(365),
  basePriceCents: cents,
  currency: currency.default("USD"),
  maxCapacity: z.number().int().min(1).max(10_000),
  photoUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const listTourPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("tour_packages")
      .select("id, name, description, duration_days, base_price_cents, currency, max_capacity, photo_url, active, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTourPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => packageBase.extend({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      org_id: data.orgId,
      name: data.name,
      description: data.description ?? null,
      duration_days: data.durationDays,
      base_price_cents: data.basePriceCents,
      currency: data.currency,
      max_capacity: data.maxCapacity,
      photo_url: data.photoUrl ?? null,
      active: data.active,
    });
    const { data: row, error } = await context.supabase
      .from("tour_packages").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTourPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => packageBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      name: data.name,
      description: data.description ?? null,
      duration_days: data.durationDays,
      base_price_cents: data.basePriceCents,
      currency: data.currency,
      max_capacity: data.maxCapacity,
      photo_url: data.photoUrl ?? null,
      active: data.active,
    });
    const { error } = await context.supabase
      .from("tour_packages").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTourPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tour_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Guides
// ============================================================
const guideBase = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  active: z.boolean().default(true),
});

export const listTourGuides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("tour_guides")
      .select("id, name, email, phone, bio, languages, active, created_at")
      .eq("org_id", data.orgId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTourGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => guideBase.extend({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      org_id: data.orgId,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      bio: data.bio ?? null,
      languages: data.languages,
      active: data.active,
    });
    const { data: row, error } = await context.supabase
      .from("tour_guides").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTourGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => guideBase.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      bio: data.bio ?? null,
      languages: data.languages,
      active: data.active,
    });
    const { error } = await context.supabase.from("tour_guides").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTourGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tour_guides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Departures (scheduled instances)
// ============================================================
const departureBase = z.object({
  packageId: z.string().uuid(),
  startsOn: dateStr,
  endsOn: dateStr,
  priceCentsOverride: cents.optional().nullable(),
  status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).default("scheduled"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).refine((v) => v.endsOn >= v.startsOn, { message: "End date must be on/after start date", path: ["endsOn"] });

export const listTourDepartures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    packageId: z.string().uuid().optional(),
    status: z.enum(["scheduled", "confirmed", "cancelled", "completed", "all"]).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("tour_departures")
      .select(`
        id, package_id, starts_on, ends_on, price_cents_override, seats_sold, status, notes, created_at,
        tour_packages(name, base_price_cents, currency, max_capacity),
        tour_departure_guides(id, guide_id, role, tour_guides(id, name))
      `)
      .eq("org_id", data.orgId)
      .order("starts_on", { ascending: true });
    if (data.packageId) q = q.eq("package_id", data.packageId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTourDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => departureBase.and(z.object({ orgId: z.string().uuid() })).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      org_id: data.orgId,
      package_id: data.packageId,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      price_cents_override: data.priceCentsOverride ?? null,
      status: data.status,
      notes: data.notes ?? null,
    });
    const { data: row, error } = await context.supabase
      .from("tour_departures").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTourDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => departureBase.and(z.object({ id: z.string().uuid() })).parse(d))
  .handler(async ({ context, data }) => {
    const payload = nullEmpty({
      package_id: data.packageId,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
      price_cents_override: data.priceCentsOverride ?? null,
      status: data.status,
      notes: data.notes ?? null,
    });
    const { error } = await context.supabase.from("tour_departures").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTourDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tour_departures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- guide assignments -----
export const assignGuideToDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    departureId: z.string().uuid(),
    guideId: z.string().uuid(),
    role: z.string().trim().max(60).optional().or(z.literal("")),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tour_departure_guides").insert({
      org_id: data.orgId,
      departure_id: data.departureId,
      guide_id: data.guideId,
      role: data.role || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unassignGuideFromDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tour_departure_guides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Bookings
// ============================================================
const bookingBase = z.object({
  departureId: z.string().uuid(),
  guestName: z.string().trim().min(1).max(160),
  guestEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  guestPhone: z.string().trim().max(40).optional().or(z.literal("")),
  guestsCount: z.number().int().min(1).max(1000),
  totalPriceCents: cents,
  currency: currency.default("USD"),
  status: z.enum(["pending", "confirmed", "cancelled", "paid"]).default("pending"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const listTourBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    departureId: z.string().uuid().optional(),
    status: z.enum(["pending", "confirmed", "cancelled", "paid", "all"]).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("tour_bookings")
      .select(`
        id, departure_id, guest_name, guest_email, guest_phone, guests_count,
        total_price_cents, currency, status, notes, created_at,
        tour_departures(starts_on, ends_on, tour_packages(name))
      `)
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (data.departureId) q = q.eq("departure_id", data.departureId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTourBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bookingBase.extend({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Capacity check: package max_capacity vs seats already sold + this booking
    const { data: dep, error: depErr } = await context.supabase
      .from("tour_departures")
      .select("id, seats_sold, package_id, tour_packages(max_capacity)")
      .eq("id", data.departureId)
      .single();
    if (depErr || !dep) throw new Error("Departure not found");
    const cap = (dep as unknown as { tour_packages: { max_capacity: number } }).tour_packages?.max_capacity ?? 0;
    if ((dep.seats_sold ?? 0) + data.guestsCount > cap) {
      throw new Error(`Not enough seats. ${cap - (dep.seats_sold ?? 0)} remaining.`);
    }

    const payload = nullEmpty({
      org_id: data.orgId,
      departure_id: data.departureId,
      guest_name: data.guestName,
      guest_email: data.guestEmail ?? null,
      guest_phone: data.guestPhone ?? null,
      guests_count: data.guestsCount,
      total_price_cents: data.totalPriceCents,
      currency: data.currency,
      status: data.status,
      notes: data.notes ?? null,
    });
    const { data: row, error } = await context.supabase
      .from("tour_bookings").insert(payload).select("id").single();
    if (error) throw new Error(error.message);

    // Only count non-cancelled bookings toward seats_sold.
    if (data.status !== "cancelled") {
      await context.supabase.from("tour_departures")
        .update({ seats_sold: (dep.seats_sold ?? 0) + data.guestsCount })
        .eq("id", data.departureId);
    }
    return row;
  });

export const updateTourBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "confirmed", "cancelled", "paid"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: existing, error: be } = await context.supabase
      .from("tour_bookings")
      .select("id, departure_id, guests_count, status")
      .eq("id", data.id).single();
    if (be || !existing) throw new Error("Booking not found");

    const wasActive = existing.status !== "cancelled";
    const willBeActive = data.status !== "cancelled";
    const delta = (willBeActive ? existing.guests_count : 0) - (wasActive ? existing.guests_count : 0);

    const { error } = await context.supabase
      .from("tour_bookings").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (delta !== 0) {
      const { data: dep } = await context.supabase
        .from("tour_departures").select("seats_sold").eq("id", existing.departure_id).single();
      const next = Math.max(0, (dep?.seats_sold ?? 0) + delta);
      await context.supabase.from("tour_departures")
        .update({ seats_sold: next }).eq("id", existing.departure_id);
    }
    return { ok: true };
  });

export const deleteTourBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("tour_bookings").select("departure_id, guests_count, status").eq("id", data.id).single();
    const { error } = await context.supabase.from("tour_bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (existing && existing.status !== "cancelled") {
      const { data: dep } = await context.supabase
        .from("tour_departures").select("seats_sold").eq("id", existing.departure_id).single();
      const next = Math.max(0, (dep?.seats_sold ?? 0) - existing.guests_count);
      await context.supabase.from("tour_departures")
        .update({ seats_sold: next }).eq("id", existing.departure_id);
    }
    return { ok: true };
  });
