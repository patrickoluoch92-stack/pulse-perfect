// HostPulse Professionals — booking flow server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// notifications.server is imported dynamically inside handlers.

const CreateBookingInput = z.object({
  professional_id: z.string().uuid(),
  service_id: z.string().uuid().optional().nullable(),
  package_id: z.string().uuid().optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  duration_hours: z.number().positive().max(720).optional().nullable(),
  location_text: z.string().max(400).optional().nullable(),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
  requirements: z.string().max(2000).optional().nullable(),
  reference_files: z.array(z.object({ path: z.string(), name: z.string() })).optional().nullable(),
  guest_count: z.number().int().min(0).max(100000).optional().nullable(),
  quoted_amount: z.number().nonnegative().optional().nullable(),
});

export const createProfessionalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateBookingInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve pricing
    let quoted = data.quoted_amount ?? null;
    if (!quoted && data.package_id) {
      const { data: pkg } = await supabase.from("professional_packages").select("price").eq("id", data.package_id).maybeSingle();
      quoted = pkg?.price ?? null;
    }
    if (!quoted && data.service_id) {
      const { data: svc } = await supabase.from("professional_services").select("base_price").eq("id", data.service_id).maybeSingle();
      quoted = svc?.base_price ?? null;
    }

    // Look up deposit %
    const { data: pro } = await supabase
      .from("professionals")
      .select("id, owner_id, deposit_percentage, currency, business_name")
      .eq("id", data.professional_id)
      .maybeSingle();
    if (!pro) throw new Error("Professional not found");

    const depositPct = pro.deposit_percentage ?? 30;
    const deposit = quoted ? Math.round(quoted * (depositPct / 100)) : null;

    const { data: booking, error } = await supabase
      .from("professional_bookings")
      .insert({
        professional_id: data.professional_id,
        customer_id: userId,
        service_id: data.service_id ?? null,
        package_id: data.package_id ?? null,
        event_date: data.event_date,
        event_time: data.event_time ?? null,
        duration_hours: data.duration_hours ?? null,
        location_text: data.location_text ?? null,
        location_lat: data.location_lat ?? null,
        location_lng: data.location_lng ?? null,
        requirements: data.requirements ?? null,
        reference_files: (data.reference_files ?? null) as any,
        guest_count: data.guest_count ?? null,
        quoted_amount: quoted,
        deposit_amount: deposit,
        total_amount: quoted,
        currency: pro.currency ?? "KES",
        status: "pending",
        payment_status: "unpaid",
      } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Notify professional
    try {
      const { notify } = await import("@/lib/notifications.server");
      await notify({
        userId: pro.owner_id,
        type: "professional_booking_request",
        title: "New booking request",
        body: `A customer requested ${pro.business_name} for ${data.event_date}`,
        linkUrl: `/professionals/dashboard?tab=bookings&id=${booking.id}`,
      });
    } catch {
      // best-effort
    }

    return booking;
  });

const UpdateStatusInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "decline", "request_info", "propose_alt", "confirm", "start", "complete", "cancel"]),
  notes: z.string().max(1500).optional().nullable(),
  proposed_alt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  proposed_alt_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
});

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateStatusInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error: bErr } = await supabase
      .from("professional_bookings")
      .select("id, customer_id, professional_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!booking) throw new Error("Booking not found");

    const { data: pro } = await supabase
      .from("professionals")
      .select("owner_id, business_name")
      .eq("id", booking.professional_id)
      .maybeSingle();
    const isOwner = pro?.owner_id === userId;
    const isCustomer = booking.customer_id === userId;
    if (!isOwner && !isCustomer) throw new Error("Forbidden");

    const map: Record<string, { status: string; who: "owner" | "customer" | "any" }> = {
      accept: { status: "accepted", who: "owner" },
      decline: { status: "declined", who: "owner" },
      request_info: { status: "more_info", who: "owner" },
      propose_alt: { status: "alternative_proposed", who: "owner" },
      confirm: { status: "confirmed", who: "any" },
      start: { status: "in_progress", who: "owner" },
      complete: { status: "completed", who: "owner" },
      cancel: { status: "cancelled", who: "any" },
    };
    const step = map[data.action];
    if (step.who === "owner" && !isOwner) throw new Error("Only the professional can perform this action");
    if (step.who === "customer" && !isCustomer) throw new Error("Only the customer can perform this action");

    const patch: Record<string, unknown> = { status: step.status };
    if (isOwner) patch.professional_notes = data.notes ?? null;
    else patch.customer_notes = data.notes ?? null;
    if (data.action === "propose_alt") {
      patch.proposed_alt_date = data.proposed_alt_date ?? null;
      patch.proposed_alt_time = data.proposed_alt_time ?? null;
    }
    if (data.action === "cancel") {
      patch.cancelled_by = userId;
      patch.cancelled_reason = data.notes ?? null;
      patch.cancelled_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from("professional_bookings")
      .update(patch as any)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Notify the other party
    const notifyUserId = isOwner ? booking.customer_id : pro?.owner_id;
    if (notifyUserId) {
      try {
        const { notify } = await import("@/lib/notifications.server");
        await notify({
          userId: notifyUserId,
          type: "professional_booking_update",
          title: `Booking ${step.status.replace("_", " ")}`,
          body: `${pro?.business_name ?? "Professional"} — ${data.notes ?? step.status}`,
          linkUrl: `/professionals/dashboard?tab=bookings&id=${data.id}`,
        });
      } catch {
        // best-effort
      }
    }

    return updated;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { role: "customer" | "professional" }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.role === "customer") {
      const { data: rows, error } = await supabase
        .from("professional_bookings")
        .select("*, professional:professionals(id, slug, business_name, profile_image_path, county_code, town)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return rows ?? [];
    }
    const { data: pro } = await supabase
      .from("professionals")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!pro) return [];
    const { data: rows, error } = await supabase
      .from("professional_bookings")
      .select("*")
      .eq("professional_id", pro.id)
      .order("event_date", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
