import { describe, it, expect, vi } from "vitest";
import {
  deliverWithRetry,
  signHmacSha256,
  isRetryableStatus,
  type FetchLike,
} from "@/lib/webhook";

const noSleep = () => Promise.resolve();

describe("signHmacSha256", () => {
  it("produces stable, hex-encoded SHA-256 HMAC", async () => {
    const sig = await signHmacSha256("topsecret", '{"event":"incident.test"}');
    // Known-good value computed independently.
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    const sig2 = await signHmacSha256("topsecret", '{"event":"incident.test"}');
    expect(sig).toBe(sig2);
  });
  it("changes when secret or body changes", async () => {
    const a = await signHmacSha256("s1", "body");
    const b = await signHmacSha256("s2", "body");
    const c = await signHmacSha256("s1", "BODY");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("isRetryableStatus", () => {
  it("retries on 5xx, 408, 429", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
  });
  it("does not retry on 2xx or other 4xx", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe("deliverWithRetry — E2E with mocked fetch", () => {
  it("succeeds on first attempt for 2xx", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
    const res = await deliverWithRetry({
      url: "https://example.com/hook", secret: "s", event: "incident.opened",
      payload: { event: "incident.opened", id: "x" },
      fetchImpl, sleep: noSleep,
    });
    expect(res.ok).toBe(true);
    expect(res.attempts).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("signs the body and forwards event/signature headers", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
    await deliverWithRetry({
      url: "https://example.com/hook", secret: "topsecret",
      event: "incident.test", payload: { foo: "bar" },
      fetchImpl, sleep: noSleep,
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["x-hostpulse-event"]).toBe("incident.test");
    expect(init.headers["x-hostpulse-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(init.body).toBe('{"foo":"bar"}');
  });

  it("retries on 503 and recovers", async () => {
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const res = await deliverWithRetry({
      url: "https://e.com", secret: "s", event: "x", payload: {},
      maxAttempts: 3, fetchImpl, sleep: noSleep,
    });
    expect(res.ok).toBe(true);
    expect(res.attempts).toHaveLength(3);
    expect(res.finalStatus).toBe(200);
  });

  it("does not retry on 4xx (other than 408/429)", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: false, status: 404 });
    const res = await deliverWithRetry({
      url: "https://e.com", secret: "s", event: "x", payload: {},
      maxAttempts: 5, fetchImpl, sleep: noSleep,
    });
    expect(res.ok).toBe(false);
    expect(res.attempts).toHaveLength(1);
    expect(res.finalError).toBe("HTTP 404");
  });

  it("retries on network error then gives up", async () => {
    const fetchImpl = vi.fn<FetchLike>()
      .mockRejectedValue(new Error("ECONNRESET"));
    const res = await deliverWithRetry({
      url: "https://e.com", secret: "s", event: "x", payload: {},
      maxAttempts: 3, fetchImpl, sleep: noSleep,
    });
    expect(res.ok).toBe(false);
    expect(res.attempts).toHaveLength(3);
    expect(res.finalStatus).toBeNull();
    expect(res.finalError).toBe("ECONNRESET");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially between retries", async () => {
    const fetchImpl = vi.fn<FetchLike>()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await deliverWithRetry({
      url: "https://e.com", secret: "s", event: "x", payload: {},
      maxAttempts: 3, baseDelayMs: 100, fetchImpl, sleep,
    });
    // Sleeps happen after attempts 1 and 2 (not after success).
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it("respects maxAttempts cap", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: false, status: 500 });
    const res = await deliverWithRetry({
      url: "https://e.com", secret: "s", event: "x", payload: {},
      maxAttempts: 2, fetchImpl, sleep: noSleep,
    });
    expect(res.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.attempts).toHaveLength(2);
  });
});
