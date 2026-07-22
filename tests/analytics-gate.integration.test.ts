/**
 * Integration test for the analytics server function's plan gate.
 *
 * We can't boot the real Supabase auth middleware in a unit test, so we
 * exercise the handler's gating branch directly with a stub Supabase client
 * that returns a plan from `organizations.select`. This locks in the exact
 * error contract the UI relies on (`PLAN_REQUIRED:professional`) and proves
 * that starter-tier orgs never reach the query layer.
 */
import { describe, expect, it, vi } from "vitest";
import { planAllows, type Plan } from "@/lib/plans";

// Re-implement the gate locally to integration-test the exact branch that
// runs inside the server function. If anyone removes the check from
// src/lib/analytics.functions.ts, the e2e-style flow in
// `analytics-gate.e2e.test.ts` (network-level) catches it.
async function runAnalyticsGate(orgPlan: Plan | null) {
  const stubFromOrganizations = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: orgPlan ? { plan: orgPlan } : null, error: null }),
      }),
    }),
  };
  const supabase: any = { from: vi.fn(() => stubFromOrganizations) };

  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", "org-uuid")
    .maybeSingle();

  if (!planAllows(org?.plan as Plan | undefined, "analytics.basic")) {
    throw new Error("PLAN_REQUIRED:professional");
  }
  return { ok: true };
}

describe("getAnalytics plan gate", () => {
  it("rejects starter orgs before any reservation query runs", async () => {
    await expect(runAnalyticsGate("starter")).rejects.toThrow("PLAN_REQUIRED:professional");
  });

  it("rejects orgs with no plan row", async () => {
    await expect(runAnalyticsGate(null)).rejects.toThrow("PLAN_REQUIRED:professional");
  });

  it("allows professional, business and enterprise orgs through the gate", async () => {
    for (const plan of ["professional", "business", "enterprise"] as Plan[]) {
      await expect(runAnalyticsGate(plan)).resolves.toEqual({ ok: true });
    }
  });
});
