/**
 * Webhook delivery helpers — pure functions so they are easy to unit test
 * and reuse from server functions or scheduled tasks.
 *
 * Signing: HMAC-SHA256 over the raw JSON body, hex-encoded, sent as
 *   x-hostpulse-signature: sha256=<hex>
 *
 * Retry policy: deliver with exponential backoff. Retry on network errors
 * and HTTP 5xx / 408 / 429 responses. Don't retry on 2xx (success) or
 * other 4xx (caller mistake — would just fail again).
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
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
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
  } = opts;

  const body = JSON.stringify(payload);
  const sigHex = await signHmacSha256(secret, body);
  const headers = {
    "content-type": "application/json",
    "x-hostpulse-event": event,
    "x-hostpulse-signature": `sha256=${sigHex}`,
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
    // exponential backoff: base * 2^(i-1) with small jitter cap
    await sleep(baseDelayMs * Math.pow(2, i - 1));
  }

  return { ok: false, attempts, finalStatus, finalError };
}
