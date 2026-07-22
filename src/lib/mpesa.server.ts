/**
 * Safaricom M-PESA Daraja API helpers.
 *
 * Sandbox base: https://sandbox.safaricom.co.ke
 * Production base: https://api.safaricom.co.ke
 *
 * Requires env vars (set via add_secret):
 *   MPESA_ENV                  "sandbox" | "production"
 *   MPESA_CONSUMER_KEY         Daraja app consumer key
 *   MPESA_CONSUMER_SECRET      Daraja app consumer secret
 *   MPESA_SHORTCODE            Paybill or Till number (e.g. 174379 in sandbox)
 *   MPESA_PASSKEY              Lipa-na-MPESA online passkey
 *   MPESA_CALLBACK_URL         Public URL of /api/public/mpesa/callback
 */

const getEnv = (key: string, required = true): string => {
  const v = process.env[key];
  if (!v && required) throw new Error(`${key} is not configured`);
  return v ?? "";
};

export type MpesaEnv = "sandbox" | "production";

export function getMpesaEnv(): MpesaEnv {
  return (getEnv("MPESA_ENV", false) || "sandbox") as MpesaEnv;
}

export function getMpesaBaseUrl(): string {
  return getMpesaEnv() === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/** Get an OAuth access token (valid ~3600s). */
export async function getMpesaAccessToken(): Promise<string> {
  const key = getEnv("MPESA_CONSUMER_KEY");
  const secret = getEnv("MPESA_CONSUMER_SECRET");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`M-PESA OAuth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** YYYYMMDDHHmmss in EAT (Daraja expects local Nairobi timestamp). */
export function mpesaTimestamp(d = new Date()): string {
  // EAT is UTC+3, no DST.
  const eat = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    eat.getUTCFullYear().toString() +
    pad(eat.getUTCMonth() + 1) +
    pad(eat.getUTCDate()) +
    pad(eat.getUTCHours()) +
    pad(eat.getUTCMinutes()) +
    pad(eat.getUTCSeconds())
  );
}

/** Normalize phone to 2547XXXXXXXX format. */
export function normalizeMsisdn(input: string): string {
  const digits = input.replace(/\D+/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export interface StkPushArgs {
  amountKes: number; // integer KES
  phone: string; // any format, will be normalized
  accountReference: string; // shown to user; max 12 chars
  description: string; // max 13 chars
}

export interface StkPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(args: StkPushArgs): Promise<StkPushResult> {
  const shortcode = getEnv("MPESA_SHORTCODE");
  const passkey = getEnv("MPESA_PASSKEY");
  const callbackUrl = getEnv("MPESA_CALLBACK_URL");
  const token = await getMpesaAccessToken();
  const ts = mpesaTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
  const msisdn = normalizeMsisdn(args.phone);

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(args.amountKes)),
    PartyA: msisdn,
    PartyB: shortcode,
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl,
    AccountReference: args.accountReference.slice(0, 12),
    TransactionDesc: args.description.slice(0, 13),
  };

  const res = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.ResponseCode !== "0") {
    throw new Error(
      `STK push failed: ${json.errorMessage || json.ResponseDescription || res.statusText}`,
    );
  }
  return json as StkPushResult;
}

/** Plan → KES amount. Approximate USD→KES at ~130 KES/USD. */
export const MPESA_PLAN_PRICES: Record<"professional" | "business", number> = {
  professional: 6500, // ≈ $49
  business: 19500, // ≈ $149
};
