// HostPulse Professionals — review lifecycle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubmitInput = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(160).optional().nullable(),
  body: z.string().max(4000).optional().nullable(),
});

export const submitProfessionalReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Booking must belong to this customer and be completed.
    const { data: booking, error: bErr } = await supabase
      .from("professional_bookings")
      .select("id, customer_id, professional_id, status")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!booking) throw new Error("Booking not found");
    if (booking.customer_id !== userId) throw new Error("Only the customer can review");
    if (booking.status !== "completed") throw new Error("You can review only after completion");

    // Upsert on booking_id (one review per booking).
    const { data: existing } = await supabase
      .from("professional_reviews")
      .select("id")
      .eq("booking_id", data.booking_id)
      .maybeSingle();

    const payload = {
      booking_id: data.booking_id,
      professional_id: booking.professional_id,
      customer_id: userId,
      rating: data.rating,
      title: data.title ?? null,
      body: data.body ?? null,
      is_verified: true,
    };

    const q = existing
      ? supabase
          .from("professional_reviews")
          .update(payload as any)
          .eq("id", existing.id)
          .select()
          .single()
      : supabase
          .from("professional_reviews")
          .insert(payload as any)
          .select()
          .single();

    const { data: row, error } = await q;
    if (error) throw new Error(error.message);

    // Best-effort notify the professional owner.
    try {
      const { data: pro } = await supabase
        .from("professionals")
        .select("owner_id, business_name")
        .eq("id", booking.professional_id)
        .maybeSingle();
      if (pro?.owner_id) {
        const { notify } = await import("@/lib/notifications.server");
        await notify({
          userId: pro.owner_id,
          type: "professional_review_new",
          title: `New ${data.rating}★ review`,
          body: `${pro.business_name} received a new review.`,
          linkUrl: `/professionals/dashboard?tab=reviews`,
        });
      }
    } catch {
      /* best-effort */
    }

    return row;
  });

const RespondInput = z.object({
  review_id: z.string().uuid(),
  response: z.string().min(1).max(2000),
});

export const respondToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RespondInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("professional_reviews")
      .select("id, professional_id")
      .eq("id", data.review_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!r) throw new Error("Review not found");

    const { data: pro } = await supabase
      .from("professionals")
      .select("owner_id")
      .eq("id", r.professional_id)
      .maybeSingle();
    if (pro?.owner_id !== userId) throw new Error("Only the professional owner can respond");

    const { data: updated, error } = await supabase
      .from("professional_reviews")
      .update({
        professional_response: data.response,
        responded_at: new Date().toISOString(),
      } as any)
      .eq("id", data.review_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });
