import { test, expect } from "@playwright/test";
import { installMocks, waitForAnalyticsPage, waitForUpgradeGate } from "./fixtures/mock-auth";

test.describe("/analytics plan gating", () => {
  test("starter shows the upgrade gate and no KPI cards", async ({ page }) => {
    // Install mocks BEFORE navigation
    await installMocks(page, { plan: "starter" });

    // Now navigate - mocks are already in place
    await page.goto("/analytics", { waitUntil: "domcontentloaded" });

    // Wait for upgrade gate to appear
    await waitForUpgradeGate(page);

    await expect(page.getByText(/upgrade required/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /manage plan/i })).toHaveAttribute(
      "href",
      "/settings",
    );

    // KPI cards from the real dashboard must not render.
    await expect(page.getByText(/^Occupancy$/)).toHaveCount(0);
    await expect(page.getByText(/^RevPAR$/)).toHaveCount(0);
  });

  test("professional unlocks 7d/30d but locks 90d and YTD", async ({ page }) => {
    await installMocks(page, { plan: "professional" });

    // Wait for mocks to be ready before navigation
    await page.waitForLoadState("networkidle");

    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    // ... rest of test
  });

  test("business unlocks every range and the property breakdown", async ({ page }) => {
    await installMocks(page, { plan: "business" });
    await page.goto("/analytics", { waitUntil: "domcontentloaded" });

    await waitForAnalyticsPage(page);

    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();

    // Wait for all buttons before checking
    const buttons = [
      page.getByRole("button", { name: /last 7 days/i }),
      page.getByRole("button", { name: /last 30 days/i }),
      page.getByRole("button", { name: /last 90 days/i }),
      page.getByRole("button", { name: /year to date/i }),
    ];

    for (const btn of buttons) {
      await btn.waitFor({ state: "visible", timeout: 10000 });
      await expect(btn).toBeEnabled();
    }

    // No upgrade prompt for the property breakdown.
    await expect(page.getByText(/upgrade to .*business.* to see revenue split/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /revenue by property/i })).toBeVisible();
  });

  test("enterprise also unlocks every range", async ({ page }) => {
    await installMocks(page, { plan: "enterprise" });
    await page.goto("/analytics", { waitUntil: "domcontentloaded" });

    await waitForAnalyticsPage(page);

    // Wait for all buttons before checking
    const buttons = [
      page.getByRole("button", { name: /last 7 days/i }),
      page.getByRole("button", { name: /last 30 days/i }),
      page.getByRole("button", { name: /last 90 days/i }),
      page.getByRole("button", { name: /year to date/i }),
    ];

    for (const btn of buttons) {
      await btn.waitFor({ state: "visible", timeout: 10000 });
      await expect(btn).toBeEnabled();
    }
  });
});
