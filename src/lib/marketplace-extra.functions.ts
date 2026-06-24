import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ===========================================================================
// REVIEWS
// ===========================================================================

const propIdSchema = z.object({ propertyId: z.string().uuid() });

export const listPropertyReviews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => propIdSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    const { data: rows, error } = await supabase
      .from("marketplace_property_reviews")
      .select("id, reviewer_name, rating, title, body, created_at, reviewer_id")
      .eq("property_id", data.propertyId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const submitReviewSchema = z.object({
  propertyId: z.string().uuid(),
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(2000),
});

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitReviewSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("marketplace_property_reviews")
      .upsert(
        {
          property_id: data.propertyId,
          reviewer_id: userId,
          reviewer_name: data.reviewerName,
          rating: data.rating,
          title: data.title ?? null,
          body: data.body,
        },
        { onConflict: "property_id,reviewer_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const reviewIdSchema = z.object({ id: z.string().uuid() });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reviewIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_property_reviews")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===========================================================================
// BOOKINGS
// ===========================================================================

const createBookingSchema = z.object({
  propertyId: z.string().uuid(),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(255),
  guestPhone: z.string().trim().max(40).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.number().int().min(1).max(50),
  notes: z.string().max(1000).optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createBookingSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      throw new Error("Check-out must be after check-in");
    }

    // Look up the property via the public client so we don't need cross-org RLS.
    const pub = publicSupabase();
    const { data: prop, error: propErr } = await pub
      .from("marketplace_properties")
      .select("id, price_per_night, currency, status")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (propErr) throw new Error(propErr.message);
    if (!prop || prop.status !== "approved") throw new Error("Property unavailable");

    const nights = Math.max(
      1,
      Math.round(
        (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const total = (Number(prop.price_per_night) || 0) * nights;

    const { data: row, error } = await supabase
      .from("marketplace_bookings")
      .insert({
        property_id: data.propertyId,
        guest_id: userId,
        guest_name: data.guestName,
        guest_email: data.guestEmail,
        guest_phone: data.guestPhone ?? null,
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests_count: data.guestsCount,
        total_amount: total,
        currency: prop.currency ?? "KES",
        notes: data.notes ?? null,
      })
      .select("id, total_amount, currency")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("marketplace_bookings")
      .select(
        "id, property_id, check_in, check_out, guests_count, total_amount, currency, status, created_at, marketplace_properties(name, slug, town)",
      )
      .eq("guest_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateBookingStatus = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
});

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateBookingStatus.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("marketplace_bookings")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===========================================================================
// MAP DATA
// ===========================================================================

const mapInput = z.object({
  county: z.string().optional(),
  category: z.string().optional(),
});

export const listMapProperties = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => mapInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    const supabase = publicSupabase();
    let q = supabase
      .from("marketplace_properties")
      .select(
        "id, slug, name, category, town, county_code, latitude, longitude, price_per_night, currency, rating_avg, rating_count",
      )
      .eq("status", "approved")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(2000);
    if (data.county) q = q.eq("county_code", data.county);
    if (data.category) q = q.eq("category", data.category as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
