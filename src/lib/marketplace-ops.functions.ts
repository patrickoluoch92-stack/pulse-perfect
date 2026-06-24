import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  PROPERTY_CATEGORIES,
  AVAILABILITY_OPTIONS,
  slugify,
} from "./marketplace-constants";

const categoryValues = PROPERTY_CATEGORIES.map((c) => c.value) as [string, ...string[]];
const availabilityValues = AVAILABILITY_OPTIONS.map((a) => a.value) as [string, ...string[]];

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ===========================================================================
// AVAILABILITY BLOCKS
// ===========================================================================

const propIdSchema = z.object({ propertyId: z.string().uuid() });

export const listAvailabilityBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => propIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("marketplace_availability_blocks")
      .select("id, start_date, end_date, reason, created_at")
      .eq("property_id", data.propertyId)
      .order("start_date", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const blockInput = z.object({
  propertyId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

export const addAvailabilityBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => blockInput.parse(data))
  .handler(async ({ context, data }) => {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new Error("End date must be on or after start date");
    }
    const { error } = await context.supabase
      .from("marketplace_availability_blocks")
      .insert({
        property_id: data.propertyId,
        start_date: data.startDate,
        end_date: data.endDate,
        reason: data.reason ?? null,
        created_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const idSchema = z.object({ id: z.string().uuid() });

export const removeAvailabilityBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_availability_blocks")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public check — does a date range overlap any block on an approved property?
const checkInput = z.object({
  propertyId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const checkAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => checkInput.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    const { data: blocks, error } = await supabase
      .from("marketplace_availability_blocks")
      .select("start_date, end_date")
      .eq("property_id", data.propertyId)
      .lte("start_date", data.checkOut)
      .gte("end_date", data.checkIn)
      .limit(1);
    if (error) throw new Error(error.message);
    return { available: (blocks ?? []).length === 0 };
  });

// ===========================================================================
// CSV BULK IMPORT
// ===========================================================================

const csvRowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(categoryValues),
  countyCode: z.string().trim().min(1).max(8),
  town: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(4000),
  amenities: z.array(z.string()).max(40).default([]),
  pricePerNight: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).default("KES"),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googleMapsUrl: z.string().url().max(500).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  contactWhatsapp: z.string().max(40).nullable().optional(),
  availability: z.enum(availabilityValues).default("available"),
});

const bulkInput = z.object({
  orgId: z.string().uuid(),
  rows: z.array(csvRowSchema).min(1).max(200),
});

async function uniqueSlug(supabase: any, base: string): Promise<string> {
  const root = slugify(base) || "property";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await supabase
      .from("marketplace_properties")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export const bulkImportProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bulkInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const slug = await uniqueSlug(supabase, r.name);
        const { error } = await supabase.from("marketplace_properties").insert({
          org_id: data.orgId,
          slug,
          name: r.name,
          category: r.category as any,
          county_code: r.countyCode,
          town: r.town,
          description: r.description,
          amenities: r.amenities,
          price_per_night: r.pricePerNight ?? null,
          currency: r.currency.toUpperCase(),
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          google_maps_url: r.googleMapsUrl ?? null,
          contact_email: r.contactEmail ?? null,
          contact_phone: r.contactPhone ?? null,
          contact_whatsapp: r.contactWhatsapp ?? null,
          availability: r.availability as any,
          created_by: userId,
        });
        if (error) throw error;
        imported++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e.message ?? "unknown" }); // +2 = 1-indexed + header
      }
    }
    return { imported, total: data.rows.length, errors };
  });

// ===========================================================================
// OWNER ANALYTICS
// ===========================================================================

const orgIdSchema = z.object({ orgId: z.string().uuid() });

export const getOwnerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: props, error } = await supabase
      .from("marketplace_properties")
      .select("id, name, status, is_featured, rating_avg, rating_count, price_per_night, currency")
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    const propIds = (props ?? []).map((p) => p.id);

    let bookings: any[] = [];
    if (propIds.length > 0) {
      const { data: bk, error: bkErr } = await supabase
        .from("marketplace_bookings")
        .select("id, property_id, status, total_amount, currency, check_in, check_out, created_at")
        .in("property_id", propIds);
      if (bkErr) throw new Error(bkErr.message);
      bookings = bk ?? [];
    }

    const since30 = Date.now() - 30 * 86400 * 1000;
    const recent = bookings.filter((b) => new Date(b.created_at).getTime() >= since30);

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").length;
    const pendingBookings = bookings.filter((b) => b.status === "pending").length;
    const grossRevenue = bookings
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

    // Occupancy approximation: nights confirmed / (props * 30) over last 30 days
    const nights30 = recent
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => {
        const n = Math.max(
          1,
          Math.round(
            (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000,
          ),
        );
        return sum + n;
      }, 0);
    const capacity30 = Math.max(1, (props?.length ?? 0) * 30);
    const occupancy30 = Math.min(100, Math.round((nights30 / capacity30) * 100));

    const perProperty = (props ?? []).map((p) => {
      const pb = bookings.filter((b) => b.property_id === p.id);
      const revenue = pb
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        is_featured: p.is_featured,
        rating_avg: p.rating_avg,
        rating_count: p.rating_count,
        bookings: pb.length,
        revenue,
        currency: p.currency ?? "KES",
      };
    });

    return {
      summary: {
        totalProperties: props?.length ?? 0,
        approvedProperties: (props ?? []).filter((p) => p.status === "approved").length,
        totalBookings,
        confirmedBookings,
        pendingBookings,
        grossRevenue,
        occupancy30,
        last30Bookings: recent.length,
      },
      perProperty,
    };
  });
