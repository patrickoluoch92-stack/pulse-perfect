/**
 * M-Pesa (Safaricom Daraja) STK Push callback handler.
 *
 * Public endpoint. Safaricom does NOT sign callbacks, so we treat the payload
 * as untrusted: validate structure, dedupe on CheckoutRequestID, and only
 * mutate rows we already created server-side.
 *
 * Always responds 200 with { ResultCode: 0, ResultDesc: "Accepted" } so
 * Safaricom does not retry indefinitely.
 */
// @ts-ignore deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// deno-lint-ignore no-explicit-any
type Json = any;

interface StkCallbackItem {
  Name: string;
  Value?: string | number;
}

interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: StkCallbackItem[] };
}

interface MpesaCallbackPayload {
  Body?: { stkCallback?: StkCallback };
}

interface ParsedCallback {
  merchantRequestId: string | null;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount: number | null;
  mpesaReceiptNumber: string | null;
  transactionDate: string | null; // ISO
  phoneNumber: string | null;
  status: "SUCCESS" | "FAILED";
}

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

function log(level: "info" | "warn" | "error", message: string, data?: Json) {
  // Never log secrets; payload is user-controlled and may contain a phone number.
  // eslint-disable-next-line no-console
  console[level](JSON.stringify({ fn: "mpesa-callback", level, message, data }));
}

export function validateMpesaPayload(payload: unknown): payload is MpesaCallbackPayload {
  if (!payload || typeof payload !== "object") return false;
  const cb = (payload as MpesaCallbackPayload)?.Body?.stkCallback;
  return !!cb && typeof cb.CheckoutRequestID === "string" && typeof cb.ResultCode === "number";
}

/** Daraja sends TransactionDate as a number YYYYMMDDHHmmss. */
function parseTransactionDate(value: string | number | undefined): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value);
  if (s.length !== 14) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseMpesaCallback(payload: MpesaCallbackPayload): ParsedCallback {
  const cb = payload.Body!.stkCallback!;
  const meta: Record<string, string | number> = Object.fromEntries(
    (cb.CallbackMetadata?.Item ?? [])
      .filter((i) => i && typeof i.Name === "string" && i.Value !== undefined)
      .map((i) => [i.Name, i.Value as string | number]),
  );
  const resultCode = Number(cb.ResultCode ?? -1);
  return {
    merchantRequestId: cb.MerchantRequestID ?? null,
    checkoutRequestId: cb.CheckoutRequestID!,
    resultCode,
    resultDesc: cb.ResultDesc ?? "",
    amount: meta.Amount !== undefined ? Number(meta.Amount) : null,
    mpesaReceiptNumber: (meta.MpesaReceiptNumber as string) ?? null,
    transactionDate: parseTransactionDate(meta.TransactionDate),
    phoneNumber: meta.PhoneNumber !== undefined ? String(meta.PhoneNumber) : null,
    status: resultCode === 0 ? "SUCCESS" : "FAILED",
  };
}

function getClient() {
  // @ts-ignore deno globals
  const url = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore deno globals
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function saveMpesaTransaction(
  supabase: ReturnType<typeof getClient>,
  parsed: ParsedCallback,
  rawPayload: Json,
) {
  // Upsert by checkout_request_id (unique) — prevents duplicate inserts.
  const { data, error } = await supabase
    .from("mpesa_transactions")
    .upsert(
      {
        merchant_request_id: parsed.merchantRequestId,
        checkout_request_id: parsed.checkoutRequestId,
        result_code: parsed.resultCode,
        result_desc: parsed.resultDesc,
        amount: parsed.amount,
        mpesa_receipt_number: parsed.mpesaReceiptNumber,
        transaction_date: parsed.transactionDate,
        phone_number: parsed.phoneNumber,
        status: parsed.status,
        raw_payload: rawPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "checkout_request_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMpesaTransaction(
  supabase: ReturnType<typeof getClient>,
  checkoutRequestId: string,
  patch: Record<string, Json>,
) {
  const { error } = await supabase
    .from("mpesa_transactions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("checkout_request_id", checkoutRequestId);
  if (error) throw error;
}

async function applyDomainSideEffects(
  supabase: ReturnType<typeof getClient>,
  parsed: ParsedCallback,
) {
  // Link to a subscription we created when initiating the STK push.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, org_id, plan")
    .eq("mpesa_checkout_request_id", parsed.checkoutRequestId)
    .eq("provider", "mpesa")
    .maybeSingle();

  if (!sub) return { linked: false as const };

  await supabase
    .from("mpesa_transactions")
    .update({ subscription_id: sub.id, org_id: sub.org_id })
    .eq("checkout_request_id", parsed.checkoutRequestId);

  if (parsed.status === "SUCCESS") {
    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        mpesa_receipt_number: parsed.mpesaReceiptNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    await supabase
      .from("organizations")
      .update({ plan: sub.plan, updated_at: new Date().toISOString() })
      .eq("id", sub.org_id);
  } else {
    await supabase
      .from("subscriptions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  await supabase.from("audit_logs").insert({
    org_id: sub.org_id,
    entity_type: "subscription",
    entity_id: sub.id,
    action: parsed.status === "SUCCESS" ? "mpesa_payment_succeeded" : "mpesa_payment_failed",
    metadata: {
      checkout_request_id: parsed.checkoutRequestId,
      receipt: parsed.mpesaReceiptNumber,
      amount: parsed.amount,
      result_desc: parsed.resultDesc,
    },
  });

  return { linked: true as const, subscriptionId: sub.id, orgId: sub.org_id };
}

// @ts-ignore deno serve
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS" },
    });
  }
  if (req.method !== "POST") {
    return Response.json(ACK, { status: 200 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (e) {
    log("warn", "invalid_json", { err: String(e) });
    return Response.json(ACK, { status: 200 });
  }

  log("info", "callback_received");

  if (!validateMpesaPayload(raw)) {
    log("warn", "invalid_payload_shape");
    return Response.json(ACK, { status: 200 });
  }

  try {
    const parsed = parseMpesaCallback(raw);
    log("info", "callback_parsed", {
      checkoutRequestId: parsed.checkoutRequestId,
      resultCode: parsed.resultCode,
      status: parsed.status,
    });

    const supabase = getClient();
    const saved = await saveMpesaTransaction(supabase, parsed, raw);
    log("info", "transaction_saved", { id: saved.id, status: saved.status });

    const sideEffects = await applyDomainSideEffects(supabase, parsed);
    log("info", "side_effects_applied", sideEffects);
  } catch (err) {
    // Swallow + log: Daraja must always receive 200 so it doesn't keep retrying.
    log("error", "callback_processing_failed", { err: String(err) });
  }

  return Response.json(ACK, { status: 200 });
});
