/**
 * Network-level "E2E" check against the deployed/preview server.
 *
 * Skipped by default: a real end-to-end test of plan gating requires four
 * pre-seeded users (one per plan tier) and their bearer tokens. Wire those
 * up via env vars and remove the `.skip` to run against a live environment:
 *
 *   ANALYTICS_E2E_BASE_URL=https://project--<id>.lovable.app
 *   ANALYTICS_E2E_TOKEN_STARTER=...
 *   ANALYTICS_E2E_TOKEN_PROFESSIONAL=...
 *   ANALYTICS_E2E_TOKEN_BUSINESS=...
 *   ANALYTICS_E2E_TOKEN_ENTERPRISE=...
 *   ANALYTICS_E2E_ORG_ID_STARTER=...   (etc.)
 *
 * Until those are present, this file documents the expected production
 * behaviour so the contract is explicit alongside the unit/integration tests.
 */
import { describe, expect, it } from "vitest";

const BASE = process.env.ANALYTICS_E2E_BASE_URL;
const ready =
  !!BASE &&
  !!process.env.ANALYTICS_E2E_TOKEN_STARTER &&
  !!process.env.ANALYTICS_E2E_TOKEN_PROFESSIONAL &&
  !!process.env.ANALYTICS_E2E_TOKEN_BUSINESS &&
  !!process.env.ANALYTICS_E2E_TOKEN_ENTERPRISE;

const d = describe.skipIf(!ready);

async function callAnalytics(token: string, orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const url = new URL("/_serverFn/src_lib_analytics_functions_ts--getAnalytics", BASE!);
  url.searchParams.set("payload", JSON.stringify({ data: { orgId, from: today, to: today } }));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.text() };
}

d("/analytics server fn — plan gate (live)", () => {
  it("starter receives PLAN_REQUIRED error", async () => {
    const r = await callAnalytics(
      process.env.ANALYTICS_E2E_TOKEN_STARTER!,
      process.env.ANALYTICS_E2E_ORG_ID_STARTER!,
    );
    expect(r.body).toMatch(/PLAN_REQUIRED:professional/);
  });

  it("professional succeeds for 30d but server-side ytd policy still depends on UI not requesting it", async () => {
    const r = await callAnalytics(
      process.env.ANALYTICS_E2E_TOKEN_PROFESSIONAL!,
      process.env.ANALYTICS_E2E_ORG_ID_PROFESSIONAL!,
    );
    expect(r.status).toBe(200);
    expect(r.body).not.toMatch(/PLAN_REQUIRED/);
  });

  it("business + enterprise succeed", async () => {
    for (const tier of ["BUSINESS", "ENTERPRISE"] as const) {
      const r = await callAnalytics(
        process.env[`ANALYTICS_E2E_TOKEN_${tier}`]!,
        process.env[`ANALYTICS_E2E_ORG_ID_${tier}`]!,
      );
      expect(r.status).toBe(200);
      expect(r.body).not.toMatch(/PLAN_REQUIRED/);
    }
  });
});
