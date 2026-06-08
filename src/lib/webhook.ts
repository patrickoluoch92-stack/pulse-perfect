/**
 * Webhook delivery helpers — pure functions for unit testing + reuse.
 *
 * Signing (v1, hardened):
 *   - Signs `${timestamp}.${body}` rather than the body alone — this binds
 *     each signature to a specific request time and defends against replay.
 *   - Sent as two headers:
 *       x-hostpulse-timestamp: <unix-seconds>
 *       x-hostpulse-signature: t=<ts>,v1=<hex>
 *   - A legacy header `x-hostpulse-signature-legacy: sha256=<hex>` (over body
 *     only) is also sent for one release so existing verifiers keep working.
 *
 * Retry policy: exponential backoff. Retry on network errors and HTTP
 * 5xx / 408 / 429. Don't retry on 2xx or other 4xx.
 */

export type FetchLike = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

export interface DeliveryAttempt {
  attempt: number;
  ok: boolean;
  status: number | null;
  error?: string;
}

export interface DeliveryResult {
  ok: boolean;
  attempts: DeliveryAttempt[];
  finalStatus: number | null;
  finalError: string | null;
}

export async function signHmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time hex string compare. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a v1 signature header (`t=<ts>,v1=<hex>`) against the raw body.
 * Returns true only when timestamp is within `maxAgeSec` of now AND the
 * HMAC matches in constant time.
 */
export async function verifyV1Signature(opts: {
  secret: string;
  body: string;
  signatureHeader: string | null;
  maxAgeSec?: number;
  now?: () => number;
}): Promise<boolean> {
  const { secret, body, signatureHeader, maxAgeSec = 300, now = () => Math.floor(Date.now() / 1000) } = opts;
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const ts = parseInt(parts.t ?? "", 10);
  const v1 = parts.v1;
  if (!Number.isFinite(ts) || !v1) return false;
  if (Math.abs(now() - ts) > maxAgeSec) return false;
  const expected = await signHmacSha256(secret, `${ts}.${body}`);
  return timingSafeEqualHex(v1, expected);
}

export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export interface DeliverOptions {
  url: string;
  secret: string;
  event: string;
  payload: unknown;
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Override clock for tests. Returns unix seconds. */
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function deliverWithRetry(opts: DeliverOptions): Promise<DeliveryResult> {
  const {
    url, secret, event, payload,
    maxAttempts = 3,
    baseDelayMs = 250,
    timeoutMs = 5_000,
    fetchImpl = fetch as unknown as FetchLike,
    sleep = defaultSleep,
    now = () => Math.floor(Date.now() / 1000),
  } = opts;

  const body = JSON.stringify(payload);
  const ts = now();
  const v1 = await signHmacSha256(secret, `${ts}.${body}`);
  const legacy = await signHmacSha256(secret, body);
  const headers = {
    "content-type": "application/json",
    "x-hostpulse-event": event,
    "x-hostpulse-timestamp": String(ts),
    "x-hostpulse-signature": `t=${ts},v1=${v1}`,
    // Back-compat for verifiers still on the body-only scheme.
    "x-hostpulse-signature-legacy": `sha256=${legacy}`,
  };

  const attempts: DeliveryAttempt[] = [];
  let finalStatus: number | null = null;
  let finalError: string | null = null;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers,
        body,
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(timeoutMs)
          : undefined,
      });
      finalStatus = res.status;
      attempts.push({ attempt: i, ok: res.ok, status: res.status });
      if (res.ok) {
        return { ok: true, attempts, finalStatus, finalError: null };
      }
      finalError = `HTTP ${res.status}`;
      if (!isRetryableStatus(res.status) || i === maxAttempts) {
        return { ok: false, attempts, finalStatus, finalError };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finalError = msg.slice(0, 500);
      finalStatus = null;
      attempts.push({ attempt: i, ok: false, status: null, error: finalError });
      if (i === maxAttempts) {
        return { ok: false, attempts, finalStatus, finalError };
      }
    }
    await sleep(baseDelayMs * Math.pow(2, i - 1));
  }

  return { ok: false, attempts, finalStatus, finalError };
}
