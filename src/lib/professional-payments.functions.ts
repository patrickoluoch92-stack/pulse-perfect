// HostPulse Professionals — lightweight payment tracking.
// Deposits use M-PESA manual reference for now. Customer submits their
// transaction code, the professional confirms receipt.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadBooking(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("professional_bookings")
    .select("id, customer_id, professional_id, status, payment_status, deposit_amount, total_amount, currency")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Booking not found");
  return data;
}

const SubmitRefInput = z.object({
  booking_id: z.string().uuid(),
  reference: z.string().min(4).max(60),
  scope: z.enum(["deposit", "final"]).default("deposit"),
});

export const submitPaymentReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitRefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const booking = await loadBooking(supabase, data.booking_id);
    if (booking.customer_id !== userId) throw new Error("Only the customer can submit payment");

    const nextStatus = data.scope === "deposit" ? "deposit_submitted" : "final_submitted";
    const { data: updated, error } = await supabase
      .from("professional_bookings")
      .update({
        payment_status: nextStatus,
        payment_provider: "mpesa_manual",
        payment_reference: data.reference,
      } as any)
      .eq("id", data.booking_id)
      .select()
      .single();
    if (error) throw new Error(error.message);

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
          type: "professional_payment_submitted",
          title: `${data.scope === "deposit" ? "Deposit" : "Final payment"} submitted`,
          body: `${pro.business_name}: customer submitted M-PESA reference ${data.reference}`,
          linkUrl: `/professionals/dashboard?tab=bookings&id=${data.booking_id}`,
        });
      }
    } catch {
      /* best-effort */
    }
    return updated;
  });

const ConfirmInput = z.object({
  booking_id: z.string().uuid(),
  scope: z.enum(["deposit", "final"]).default("deposit"),
});

export const confirmPaymentReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ConfirmInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const booking = await loadBooking(supabase, data.booking_id);
    const { data: pro } = await supabase
      .from("professionals")
      .select("owner_id, business_name")
      .eq("id", booking.professional_id)
      .maybeSingle();
    if (pro?.owner_id !== userId) throw new Error("Only the professional can confirm payment");

    const nextStatus = data.scope === "deposit" ? "deposit_paid" : "paid";
    const { data: updated, error } = await supabase
      .from("professional_bookings")
      .update({ payment_status: nextStatus } as any)
      .eq("id", data.booking_id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    try {
      const { notify } = await import("@/lib/notifications.server");
      await notify({
        userId: booking.customer_id,
        type: "professional_payment_confirmed",
        title: `${data.scope === "deposit" ? "Deposit" : "Payment"} confirmed`,
        body: `${pro?.business_name ?? "Your professional"} confirmed your payment.`,
        linkUrl: `/professionals/dashboard?tab=customer&id=${data.booking_id}`,
      });
    } catch {
      /* best-effort */
    }
    return updated;
  });
