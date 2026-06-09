import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability.functions", () => ({
  reportAppError: vi.fn(async () => ({ ok: true })),
}));

import { reportAppError } from "@/lib/observability.functions";
import {
  addBreadcrumb,
  captureError,
  clearBreadcrumbs,
  clearErrorContext,
  getBreadcrumbs,
  newCorrelationId,
  setErrorContext,
  withErrorCapture,
  withErrorContext,
} from "@/lib/error-capture";

const reportMock = vi.mocked(reportAppError);

afterEach(() => {
  reportMock.mockClear();
  clearErrorContext();
  clearBreadcrumbs();
});

describe("error-capture metadata", () => {
  it("merges ambient context into captured errors", async () => {
    setErrorContext({ tenantId: "11111111-1111-1111-1111-111111111111", userId: "22222222-2222-2222-2222-222222222222", action: "fromAmbient" });
    captureError(new Error("boom"), "test");
    await flushMicro();
    expect(reportMock).toHaveBeenCalledTimes(1);
    const payload = reportMock.mock.calls[0][0].data;
    expect(payload.action).toBe("fromAmbient");
    expect(payload.tenantId).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.userId).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.message).toBe("boom");
  });

  it("withErrorCapture generates a correlation id shared by downstream captures", async () => {
    const inner = vi.fn(async () => {
      captureError(new Error("inner-warn"), "inner");
      throw new Error("outer");
    });
    const wrapped = withErrorCapture(inner, "wrap", { action: "doThing" });
    await expect(wrapped()).rejects.toThrow("outer");
    await flushMicro();
    expect(reportMock).toHaveBeenCalledTimes(2);
    const cids = reportMock.mock.calls.map((c) => c[0].data.correlationId);
    expect(cids[0]).toBeTruthy();
    expect(cids[0]).toEqual(cids[1]);
    expect(reportMock.mock.calls[0][0].data.action).toBe("doThing");
  });

  it("inherits an existing ambient correlation id rather than minting a new one", async () => {
    const cid = "fixed-correlation-id";
    await withErrorContext({ correlationId: cid }, async () => {
      const wrapped = withErrorCapture(async () => {
        throw new Error("x");
      }, "src");
      await expect(wrapped()).rejects.toThrow();
    });
    await flushMicro();
    expect(reportMock.mock.calls[0][0].data.correlationId).toBe(cid);
  });

  it("throttles identical (source,action,message,correlation) tuples", async () => {
    setErrorContext({ correlationId: "cid-1", action: "act" });
    captureError(new Error("dup"), "src");
    captureError(new Error("dup"), "src");
    captureError(new Error("dup"), "src");
    await flushMicro();
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it("does not collapse rows that differ by correlation id", async () => {
    setErrorContext({ action: "act" });
    captureError(new Error("same"), "src", { correlationId: "a" });
    captureError(new Error("same"), "src", { correlationId: "b" });
    await flushMicro();
    expect(reportMock).toHaveBeenCalledTimes(2);
  });

  it("ships breadcrumbs in the error payload (capped to last 25)", async () => {
    for (let i = 0; i < 30; i++) addBreadcrumb({ category: "ui", message: `step-${i}` });
    captureError(new Error("with crumbs"), "src");
    await flushMicro();
    const payload = reportMock.mock.calls[0][0].data;
    expect(payload.breadcrumbs).toHaveLength(25);
    expect(payload.breadcrumbs![24].message).toBe("step-29");
    expect(payload.breadcrumbs![0].message).toBe("step-5");
  });

  it("breadcrumb ring buffer caps at 50 entries", () => {
    for (let i = 0; i < 75; i++) addBreadcrumb({ category: "log", message: `m${i}` });
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(50);
    expect(crumbs[0].message).toBe("m25");
    expect(crumbs[49].message).toBe("m74");
  });

  it("newCorrelationId returns unique values", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

function flushMicro() {
  return new Promise((r) => setTimeout(r, 0));
}
