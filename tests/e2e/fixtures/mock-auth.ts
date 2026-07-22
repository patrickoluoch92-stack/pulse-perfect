import type { Page, Route } from "@playwright/test";
import type { Plan } from "../../../src/lib/plans";

/**
 * Test helper to bypass the `_authenticated` gate and stub workspace + analytics
 * server functions so we can drive the UI through every plan tier without a
 * real backend session.
 *
 * Strategy:
 *  - Set up route handlers BEFORE navigation (critical for mocking)
 *  - Seed localStorage with a fake supabase session before any app code runs
 *  - Intercept Supabase REST auth endpoints (`/auth/v1/user`, token refresh)
 *  - Intercept TanStack Start server function calls (`/_serverFn/**`)
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

/**
 * Install mock auth and server functions BEFORE navigation.
 * This is critical: route handlers must be registered before any network requests occur.
 */
export async function installMocks(page: Page, opts: MockOptions) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const storageKey = supabaseUrl
    ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
    : "sb-auth-token";

  // Step 1: Register route handlers FIRST (before any navigation)
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
            profile: {
              id: FAKE_USER.id,
              full_name: "Test User",
              avatar_url: null,
              current_org_id: "org-1",
            },
            organizations: [
              { id: "org-1", name: "Test Org", slug: "test-org", plan: opts.plan, role: "owner" },
            ],
            currentOrg: {
              id: "org-1",
              name: "Test Org",
              slug: "test-org",
              plan: opts.plan,
              role: "owner",
            },
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

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: null }),
    });
  });

  // Step 2: Seed localStorage AFTER routes are registered
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
}

/**
 * Wait for the analytics page to fully load with mocked data.
 * Ensures heading and KPI elements are present before assertions.
 */
export async function waitForAnalyticsPage(page: Page) {
  // Wait for the main heading to be visible
  await page
    .getByRole("heading", { name: "Analytics", level: 1 })
    .waitFor({ state: "visible", timeout: 10000 });

  // Wait for at least one KPI card to render
  await page.getByText("Occupancy", { exact: true }).waitFor({ state: "visible", timeout: 10000 });

  // Wait for network to be idle to ensure all data has loaded
  await page.waitForLoadState("networkidle", { timeout: 10000 });
}

/**
 * Wait for upgrade gate to appear (for restricted plans)
 */
export async function waitForUpgradeGate(page: Page) {
  await page
    .getByRole("heading", { name: /unlock analytics/i })
    .waitFor({ state: "visible", timeout: 10000 });
  await page.getByText(/upgrade required/i).waitFor({ state: "visible", timeout: 10000 });
}
