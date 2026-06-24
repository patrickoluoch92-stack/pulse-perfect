import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { initiateStkPush, MPESA_PLAN_PRICES, getMpesaEnv } from "./mpesa.server";

const subSchema = z.object({
  orgId: z.string().uuid(),
  plan: z.enum(["professional", "business"]),
  phone: z.string().min(7).max(20),
});

export const startMpesaCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

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
      mpesa_phone: data.phone,
      mpesa_amount_kes: amount,
      environment: getMpesaEnv() === "production" ? "live" : "sandbox",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    return { checkoutRequestId: stk.CheckoutRequestID, customerMessage: stk.CustomerMessage };
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

// ---------------------------------------------------------------------------
// Invoice payments via M-PESA STK Push
// ---------------------------------------------------------------------------

const invSchema = z.object({
  invoiceId: z.string().uuid(),
  phone: z.string().min(7).max(20),
});

export const startMpesaCheckoutForInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => invSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Read invoice via the user's RLS-scoped client — guarantees they have access.
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, org_id, total, currency, status, number")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!invoice) throw new Error("Invoice not found or not accessible.");
    if (invoice.status === "paid") throw new Error("Invoice is already paid.");

    // Verify the caller can collect payment for this org.
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", invoice.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member || !["owner", "admin", "manager"].includes(member.role)) {
      throw new Error("You don't have permission to collect payments.");
    }

    const amountKes = Math.max(1, Math.round(Number(invoice.total)));
    const stk = await initiateStkPush({
      amountKes,
      phone: data.phone,
      accountReference: invoice.number.slice(0, 12),
      description: "Invoice",
    });

    // Pre-insert mpesa_transactions row so the callback can resolve invoice_id.
    // RLS blocks user writes here, so use the admin client (dynamic import — server only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: txErr } = await supabaseAdmin.from("mpesa_transactions").insert({
      checkout_request_id: stk.CheckoutRequestID,
      merchant_request_id: stk.MerchantRequestID,
      status: "PENDING",
      amount: amountKes,
      phone_number: data.phone,
      org_id: invoice.org_id,
      invoice_id: invoice.id,
      result_code: null,
      result_desc: null,
      raw_payload: { initiated_by: userId, customer_message: stk.CustomerMessage },
    });
    if (txErr) throw new Error(txErr.message);

    return { checkoutRequestId: stk.CheckoutRequestID, customerMessage: stk.CustomerMessage };
  });

export const getInvoiceMpesaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ checkoutRequestId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("mpesa_transactions")
      .select("status, result_desc, mpesa_receipt_number, amount, invoice_id")
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    return row ?? { status: "PENDING" };
  });

// ---------------------------------------------------------------------------
// Admin screen reads
// ---------------------------------------------------------------------------

export const listMpesaTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("mpesa_transactions")
      .select("id, checkout_request_id, merchant_request_id, status, result_code, result_desc, amount, phone_number, mpesa_receipt_number, transaction_date, created_at, invoice_id, subscription_id")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
