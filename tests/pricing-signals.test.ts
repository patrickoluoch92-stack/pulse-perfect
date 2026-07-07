import { describe, it, expect } from "vitest";
import { applySignalsForDate } from "@/lib/pricing-signals.functions";

describe("applySignalsForDate", () => {
  it("returns 1× multiplier when no signals apply", () => {
    const r = applySignalsForDate("2026-08-01", 1000, []);
    expect(r.multiplier).toBe(1);
    expect(r.reasons).toEqual([]);
  });

  it("boosts price on event signal weighted", () => {
    const r = applySignalsForDate("2026-08-01", 1000, [
      { signal_type: "event", observed_on: "2026-08-01", valid_until: null, price_amount: null, weight: 1 },
    ]);
    expect(r.multiplier).toBeCloseTo(1.2);
    expect(r.reasons).toContain("local event");
  });

  it("nudges toward competitor rate", () => {
    const r = applySignalsForDate("2026-08-01", 1000, [
      { signal_type: "competitor_rate", observed_on: "2026-08-01", valid_until: null, price_amount: 1400, weight: 1 },
    ]);
    // nudge = 1 + (1.4 - 1) * 0.3 = 1.12
    expect(r.multiplier).toBeCloseTo(1.12, 2);
  });

  it("ignores signals outside validity window", () => {
    const r = applySignalsForDate("2026-08-05", 1000, [
      { signal_type: "event", observed_on: "2026-08-01", valid_until: "2026-08-03", price_amount: null, weight: 1 },
    ]);
    expect(r.multiplier).toBe(1);
  });
});
