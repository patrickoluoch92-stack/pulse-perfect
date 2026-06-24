import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// JSDOM-free smoke test for the perf module — exercises the public API path
// without a DOM by stubbing the bare minimum browser globals.

describe("lib/perf", () => {
  beforeEach(() => {
    // @ts-expect-error mock global
    globalThis.window = globalThis;
    // @ts-expect-error mock global
    globalThis.document = { visibilityState: "visible" };
    // @ts-expect-error mock global
    globalThis.location = { pathname: "/" };
    // @ts-expect-error mock global
    globalThis.navigator = { sendBeacon: vi.fn(() => true) };
    // @ts-expect-error mock global
    globalThis.performance = {
      getEntriesByType: () => [],
    };
    // @ts-expect-error mock global
    globalThis.PerformanceObserver = class {
      observe() {}
      disconnect() {}
    };
    (globalThis as unknown as { addEventListener: (...a: unknown[]) => void }).addEventListener = () => {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup
    delete globalThis.window;
    // @ts-expect-error cleanup
    delete globalThis.PerformanceObserver;
  });

  it("initWebVitals runs without throwing", async () => {
    const { initWebVitals } = await import("@/lib/perf");
    expect(() => initWebVitals()).not.toThrow();
  });
});
