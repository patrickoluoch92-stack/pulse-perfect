import { describe, it, expect } from "vitest";

// Smoke test the perf module without a DOM. We can't safely override
// read-only globals (navigator, performance) in Node, so we just verify
// the module imports and exports the expected shape — the absence of
// `window` makes initWebVitals a fast no-op.
describe("lib/perf", () => {
  it("exports initWebVitals and is a no-op without window", async () => {
    const mod = await import("@/lib/perf");
    expect(typeof mod.initWebVitals).toBe("function");
    expect(() => mod.initWebVitals()).not.toThrow();
  });
});
