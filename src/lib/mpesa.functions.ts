import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { initiateStkPush, MPESA_PLAN_PRICES, getMpesaEnv } from "./mpesa.server";

const schema = z.object({
  orgId: z.string().uuid(),
  plan: z.enum(["professional", "business"]),
  phone: z.string().min(7).max(20),
});

export const startMpesaCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is an org member.
    const { data: member, error: mErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", data.orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("Only owners and admins can purchase plans.");
    }

    const amount = MPESA_PLAN_PRICES[data.plan];
    const stk = await initiateStkPush({
      amountKes: amount,
      phone: data.phone,
      accountReference: `HP-${data.orgId.slice(0, 8)}`,
      description: data.plan === "professional" ? "Pro plan" : "Biz plan",
    });

    // Record pending subscription row — webhook callback will mark it active.
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    await supabase.from("subscriptions").insert({
      org_id: data.orgId,
      user_id: userId,
      provider: "mpesa",
      plan: data.plan,
      status: "pending",
      mpesa_checkout_request_id: stk.CheckoutRequestID,
      mpesa_merchant_request_id: stk.MerchantRequestID,
      mpesa_phone: stk.CheckoutRequestID ? data.phone : data.phone,
      mpesa_amount_kes: amount,
      environment: getMpesaEnv() === "production" ? "live" : "sandbox",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    return {
      checkoutRequestId: stk.CheckoutRequestID,
      customerMessage: stk.CustomerMessage,
    };
  });

export const getMpesaCheckoutStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ checkoutRequestId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("status, plan, current_period_end")
      .eq("mpesa_checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    return row ?? { status: "pending" };
  });
