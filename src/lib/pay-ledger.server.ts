// Server-only: Daraja B2C / STK query + webhook processing for the payments ledger.
// Money movement itself happens inside Postgres functions (pay_*) so each step
// is one DB transaction with row locks and idempotency keys.
import { getMpesaAccessToken, getMpesaBaseUrl, mpesaTimestamp, normalizeMsisdn } from "./mpesa.server";
import { maskMsisdn, minorToWholeKes } from "./money";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not configured`);
  return v;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ at: new Date().toISOString(), svc: "payments", event, ...fields }));
}

/** Constant-time check of the secret token embedded in callback URLs. */
export async function verifyCallbackToken(token: string | undefined): Promise<boolean> {
  const expected = process.env["MPESA_CALLBACK_TOKEN"];
  if (!expected || !token) return false;
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyCronSecret(request: Request): Promise<boolean> {
  const expected = process.env["PARTNER_SYNC_CRON_SECRET"];
  const h = request.headers.get("authorization") ?? "";
  const provided = h.startsWith("Bearer ") ? h.slice(7) : request.headers.get("x-cron-secret");
  if (!expected || !provided) return false;
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Store raw webhook once. Returns event id, or null when it is a duplicate. */
export async function recordWebhook(source: string, externalId: string, payload: unknown) {
  const db = await admin();
  const { data, error } = await db
    .from("pay_webhook_events")
    .insert({ source, external_id: externalId, payload })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  return data?.id as string;
}

async function markEvent(id: string, err?: string) {
  const db = await admin();
  await db
    .from("pay_webhook_events")
    .update({ processed_at: err ? null : new Date().toISOString(), error: err ?? null })
    .eq("id", id);
}

// ---------- STK ----------
export async function processStkEvent(eventId: string, payload: any) {
  const cb = payload?.Body?.stkCallback;
  try {
    const items: { Name: string; Value?: unknown }[] = cb?.CallbackMetadata?.Item ?? [];
    const get = (n: string) => items.find((i) => i.Name === n)?.Value;
    const amountKes = get("Amount");
    const amountMinor = amountKes == null ? null : Math.round(Number(amountKes)) * 100;
    const db = await admin();
    const { data, error } = await db.rpc("pay_process_stk", {
      _checkout: String(cb.CheckoutRequestID),
      _result_code: Number(cb.ResultCode),
      _receipt: get("MpesaReceiptNumber") ? String(get("MpesaReceiptNumber")) : null,
      _amount_minor: amountMinor,
      _desc: String(cb.ResultDesc ?? ""),
    });
    if (error) throw new Error(error.message);
    log("stk_processed", { checkout: cb.CheckoutRequestID, result: data });
    await markEvent(eventId);
  } catch (e) {
    log("stk_error", { checkout: cb?.CheckoutRequestID, err: String(e) });
    await markEvent(eventId, String(e));
  }
}

export async function initiateBookingStk(args: {
  bookingId: string;
  amountMinor: number;
  phone: string;
  reference: string;
}) {
  const shortcode = env("MPESA_SHORTCODE");
  const passkey = env("MPESA_PASSKEY");
  const base = env("PAYMENTS_PUBLIC_BASE_URL");
  const token = env("MPESA_CALLBACK_TOKEN");
  const ts = mpesaTimestamp();
  const msisdn = normalizeMsisdn(args.phone);
  const res = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getMpesaAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64"),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: minorToWholeKes(args.amountMinor),
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: `${base}/api/public/mpesa/stk/${token}`,
      AccountReference: args.reference.slice(0, 12),
      TransactionDesc: "Booking",
    }),
  });
  const json = await res.json();
  if (!res.ok || json.ResponseCode !== "0") throw new Error(json.errorMessage || "STK push failed");
  const db = await admin();
  const { error } = await db.from("pay_payments").insert({
    booking_id: args.bookingId,
    checkout_request_id: json.CheckoutRequestID,
    merchant_request_id: json.MerchantRequestID,
    amount_minor: args.amountMinor,
    msisdn_masked: maskMsisdn(msisdn),
  });
  if (error) throw new Error(error.message);
  log("stk_initiated", { booking_id: args.bookingId, checkout: json.CheckoutRequestID });
  return { checkoutRequestId: json.CheckoutRequestID as string, customerMessage: json.CustomerMessage as string };
}

/** Fallback for missed callbacks: query Daraja for payments stuck in "initiated". */
export async function checkStuckPayments() {
  const db = await admin();
  const { data: cfg } = await db.from("pay_config").select("stuck_payment_minutes").single();
  const cutoff = new Date(Date.now() - (cfg?.stuck_payment_minutes ?? 3) * 60_000).toISOString();
  const { data: rows } = await db
    .from("pay_payments")
    .select("checkout_request_id")
    .eq("status", "initiated")
    .lt("created_at", cutoff)
    .limit(50);
  const shortcode = env("MPESA_SHORTCODE");
  const passkey = env("MPESA_PASSKEY");
  const token = await getMpesaAccessToken();
  let checked = 0;
  for (const r of rows ?? []) {
    const ts = mpesaTimestamp();
    const res = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64"),
        Timestamp: ts,
        CheckoutRequestID: r.checkout_request_id,
      }),
    });
    const j = await res.json().catch(() => ({}));
    checked++;
    // Query gives no receipt, so success is left for the callback/reconciliation;
    // definitive failures are closed here.
    if (j.ResultCode !== undefined && String(j.ResultCode) !== "0") {
      await db.rpc("pay_process_stk", {
        _checkout: r.checkout_request_id,
        _result_code: Number(j.ResultCode),
        _receipt: null,
        _amount_minor: null,
        _desc: String(j.ResultDesc ?? "query failure"),
      });
    } else if (String(j.ResultCode) === "0") {
      log("stk_query_success_awaiting_callback", { checkout: r.checkout_request_id });
    }
  }
  return { checked };
}

// ---------- B2C ----------
async function sendB2C(ocid: string, amountMinor: number, msisdn: string, remarks: string) {
  const base = env("PAYMENTS_PUBLIC_BASE_URL");
  const token = env("MPESA_CALLBACK_TOKEN");
  const res = await fetch(`${getMpesaBaseUrl()}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getMpesaAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: ocid,
      InitiatorName: env("MPESA_B2C_INITIATOR"),
      SecurityCredential: env("MPESA_B2C_SECURITY_CREDENTIAL"),
      CommandID: "BusinessPayment",
      Amount: minorToWholeKes(amountMinor),
      PartyA: env("MPESA_B2C_SHORTCODE"),
      PartyB: normalizeMsisdn(msisdn),
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: `${base}/api/public/mpesa/b2c-timeout/${token}`,
      ResultURL: `${base}/api/public/mpesa/b2c-result/${token}`,
      Occasion: "",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ResponseCode !== "0") throw new Error(j.errorMessage || j.ResponseDescription || "B2C rejected");
  return j.ConversationID as string;
}

export async function runPayouts() {
  const db = await admin();
  const { data: built } = await db.rpc("pay_build_payouts");
  const { data: claimed } = await db.rpc("pay_claim_payouts", { _limit: 20 });
  const { data: cfg } = await db.from("pay_config").select("max_payout_attempts").single();
  let sent = 0;
  for (const p of claimed ?? []) {
    const { data: prov } = await db.from("pay_providers").select("payout_msisdn").eq("id", p.provider_id).single();
    try {
      if (!prov?.payout_msisdn) throw new Error("provider has no payout phone number");
      const conv = await sendB2C(p.originator_conversation_id, p.amount_minor, prov.payout_msisdn, "HostPulse payout");
      await db.from("pay_payouts").update({ conversation_id: conv }).eq("id", p.id);
      sent++;
    } catch (e) {
      await db.rpc("pay_payout_result", {
        _ocid: p.originator_conversation_id, _success: false, _receipt: null, _fee_minor: 0, _reason: String(e),
      });
      if (p.attempts >= (cfg?.max_payout_attempts ?? 5)) log("payout_alert_max_attempts", { payout_id: p.id });
    }
  }
  // Refunds waiting to be sent
  const { data: refunds } = await db.from("pay_refunds").select("*").in("status", ["pending", "failed"]).lt("attempts", 5).limit(20);
  for (const r of refunds ?? []) {
    try {
      if (!r.msisdn) throw new Error("no refund phone number");
      await db.from("pay_refunds").update({ status: "processing", attempts: r.attempts + 1 }).eq("id", r.id).in("status", ["pending", "failed"]);
      await sendB2C(r.originator_conversation_id, r.amount_minor, r.msisdn, "HostPulse refund");
    } catch (e) {
      await db.rpc("pay_refund_result", { _ocid: r.originator_conversation_id, _success: false, _receipt: null, _reason: String(e) });
    }
  }
  return { built: built ?? 0, claimed: claimed?.length ?? 0, sent };
}

export async function processB2CEvent(eventId: string, payload: any, timeout: boolean) {
  const r = payload?.Result;
  try {
    const ocid = String(r?.OriginatorConversationID ?? "");
    const success = !timeout && Number(r?.ResultCode) === 0;
    const reason = timeout ? "timeout" : String(r?.ResultDesc ?? "");
    const receipt = r?.TransactionID ? String(r.TransactionID) : null;
    const db = await admin();
    const fn = ocid.startsWith("refund-") ? "pay_refund_result" : "pay_payout_result";
    const args: Record<string, unknown> = { _ocid: ocid, _success: success, _receipt: receipt, _reason: reason };
    if (fn === "pay_payout_result") args._fee_minor = 0; // fee posted from settlement statement
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(error.message);
    log("b2c_processed", { ocid, result: data, timeout });
    await markEvent(eventId);
  } catch (e) {
    log("b2c_error", { err: String(e) });
    await markEvent(eventId, String(e));
  }
}

/** Retry webhook events that failed processing. */
export async function reprocessWebhooks() {
  const db = await admin();
  const { data } = await db.from("pay_webhook_events").select("*").is("processed_at", null).lt("attempts", 10).limit(50);
  for (const ev of data ?? []) {
    await db.from("pay_webhook_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id);
    if (ev.source === "stk") await processStkEvent(ev.id, ev.payload);
    else await processB2CEvent(ev.id, ev.payload, ev.source === "b2c_timeout");
  }
  return { retried: data?.length ?? 0 };
}
