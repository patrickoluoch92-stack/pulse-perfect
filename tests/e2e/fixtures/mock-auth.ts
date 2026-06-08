import type { Page, Route } from "@playwright/test";
import type { Plan } from "../../../src/lib/plans";

/**
 * Test helper to bypass the `_authenticated` gate and stub workspace + analytics
 * server functions so we can drive the UI through every plan tier without a
 * real backend session.
 *
 * Strategy:
 *  - Seed localStorage with a fake supabase session before any app code runs.
 *  - Intercept Supabase REST auth endpoints (`/auth/v1/user`, token refresh).
 *  - Intercept TanStack Start server function calls (`/_serverFn/**`). The
 *    workspace-context fn is `method:"GET"` and the analytics fn is POST with
 *    `{ data: { orgId, ... } }`, so we route by HTTP method.
 */
export type MockOptions = {
  plan: Plan;
  /** Override analytics payload — defaults to a small synthetic dataset. */
  analytics?: Partial<AnalyticsPayload>;
};

type AnalyticsPayload = {
  occupancyRate: number;
  occupiedNights: number;
  availableNights: number;
  revenue: number;
  bookings: number;
  adr: number;
  revpar: number;
  series: Array<{ date: string; revenue: number; nights: number }>;
  propertyChart: Array<{ name: string; revenue: number }>;
  sourceBreakdown: Record<string, number>;
};

const FAKE_USER = {
  id: "00000000-0000-0000-0000-00000000beef",
  aud: "authenticated",
  role: "authenticated",
  email: "tester@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};

const FAKE_SESSION = {
  access_token: "fake.jwt.token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh",
  user: FAKE_USER,
};

function defaultAnalytics(): AnalyticsPayload {
  return {
    occupancyRate: 0.74,
    occupiedNights: 222,
    availableNights: 300,
    revenue: 48250,
    bookings: 37,
    adr: 217,
    revpar: 161,
    series: [
      { date: "2026-05-10", revenue: 1200, nights: 8 },
      { date: "2026-05-11", revenue: 1450, nights: 9 },
      { date: "2026-05-12", revenue: 980, nights: 6 },
    ],
    propertyChart: [
      { name: "Seaside Loft", revenue: 18200 },
      { name: "Downtown Studio", revenue: 12400 },
    ],
    sourceBreakdown: { airbnb: 22, direct: 10, booking_com: 5 },
  };
}

export async function installMocks(page: Page, opts: MockOptions) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const storageKey = supabaseUrl
    ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
    : "sb-auth-token";

  await page.addInitScript(
    ({ key, session }) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(session));
      } catch {
        /* ignore */
      }
    },
    { key: storageKey, session: FAKE_SESSION },
  );

  // Supabase REST auth endpoints
  await page.route(/\/auth\/v1\/(user|token).*/, async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(FAKE_USER),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_SESSION),
    });
  });

  // TanStack Start server functions
  const analyticsBody = { ...defaultAnalytics(), ...(opts.analytics ?? {}) };

  await page.route(/\/_serverFn\//, async (route: Route) => {
    const req = route.request();
    const method = req.method();

    // Workspace context — TanStack Start serializes GET fns as GET requests.
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            profile: { id: FAKE_USER.id, full_name: "Test User", avatar_url: null, current_org_id: "org-1" },
            organizations: [
              { id: "org-1", name: "Test Org", slug: "test-org", plan: opts.plan, role: "owner" },
            ],
            currentOrg: { id: "org-1", name: "Test Org", slug: "test-org", plan: opts.plan, role: "owner" },
          },
        }),
      });
    }

    // POST server fns — analytics is the only one /analytics calls.
    const post = req.postDataJSON?.() ?? null;
    const isAnalytics = post && (post.data?.orgId || post.orgId);
    if (isAnalytics) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: analyticsBody }),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: null }) });
  });
}
