import { describe, expect, it } from "vitest";
import { planAllows, requiredPlanFor, PLAN_RANK, type Plan, type Feature } from "@/lib/plans";

const PLANS: Plan[] = ["starter", "professional", "business", "enterprise"];

// Mirrors the RANGES array in src/routes/_authenticated/analytics.tsx so a
// drift between UI and policy fails this test.
const RANGE_FEATURES: { key: string; feature: Feature }[] = [
  { key: "7d", feature: "analytics.basic" },
  { key: "30d", feature: "analytics.basic" },
  { key: "90d", feature: "analytics.range.90d" },
  { key: "ytd", feature: "analytics.range.ytd" },
];

describe("planAllows", () => {
  it("denies every analytics feature for a missing/null plan", () => {
    for (const f of [
      "analytics.basic",
      "analytics.range.90d",
      "analytics.range.ytd",
      "analytics.property_breakdown",
    ] as Feature[]) {
      expect(planAllows(null, f)).toBe(false);
      expect(planAllows(undefined, f)).toBe(false);
    }
  });

  it("denies all analytics features on the starter plan", () => {
    expect(planAllows("starter", "analytics.basic")).toBe(false);
    expect(planAllows("starter", "analytics.range.90d")).toBe(false);
    expect(planAllows("starter", "analytics.range.ytd")).toBe(false);
    expect(planAllows("starter", "analytics.property_breakdown")).toBe(false);
  });

  it("grants basic analytics + 90d to professional, but not ytd or property breakdown", () => {
    expect(planAllows("professional", "analytics.basic")).toBe(true);
    expect(planAllows("professional", "analytics.range.90d")).toBe(true);
    expect(planAllows("professional", "analytics.range.ytd")).toBe(false);
    expect(planAllows("professional", "analytics.property_breakdown")).toBe(false);
  });

  it("grants every analytics feature to business and enterprise", () => {
    for (const plan of ["business", "enterprise"] as Plan[]) {
      expect(planAllows(plan, "analytics.basic")).toBe(true);
      expect(planAllows(plan, "analytics.range.90d")).toBe(true);
      expect(planAllows(plan, "analytics.range.ytd")).toBe(true);
      expect(planAllows(plan, "analytics.property_breakdown")).toBe(true);
    }
  });

  it("is monotonic: higher-ranked plans never lose features", () => {
    const sorted = [...PLANS].sort((a, b) => PLAN_RANK[a] - PLAN_RANK[b]);
    const features: Feature[] = [
      "analytics.basic",
      "analytics.range.90d",
      "analytics.range.ytd",
      "analytics.property_breakdown",
    ];
    for (const f of features) {
      let seenAllowed = false;
      for (const p of sorted) {
        const allowed = planAllows(p, f);
        if (seenAllowed && !allowed) {
          throw new Error(`Feature ${f} downgraded at plan ${p}`);
        }
        if (allowed) seenAllowed = true;
      }
    }
  });
});

describe("analytics range gating (UI parity)", () => {
  // Locked combinations the UI must visually disable + the server fn must reject.
  const expected: Record<Plan, string[]> = {
    starter: ["7d", "30d", "90d", "ytd"],
    professional: ["ytd"],
    business: [],
    enterprise: [],
  };

  for (const plan of PLANS) {
    it(`plan="${plan}" locks exactly: [${expected[plan].join(", ")}]`, () => {
      const lockedKeys = RANGE_FEATURES.filter((r) => !planAllows(plan, r.feature)).map(
        (r) => r.key,
      );
      // Starter is also blocked at the page level (no basic analytics), but the
      // per-range matrix should still derive consistently from the feature flags.
      expect(lockedKeys.sort()).toEqual([...expected[plan]].sort());
    });
  }
});

describe("requiredPlanFor", () => {
  it("returns the minimum plan required for each feature", () => {
    expect(requiredPlanFor("analytics.basic")).toBe("professional");
    expect(requiredPlanFor("analytics.range.90d")).toBe("professional");
    expect(requiredPlanFor("analytics.range.ytd")).toBe("business");
    expect(requiredPlanFor("analytics.property_breakdown")).toBe("business");
  });
});
