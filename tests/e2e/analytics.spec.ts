import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("/analytics plan gating", () => {
  test("starter shows the upgrade gate and no KPI cards", async ({ page }) => {
    await installMocks(page, { plan: "starter" });
    await page.goto("/analytics");

    await expect(page.getByRole("heading", { name: /unlock analytics/i })).toBeVisible();
    await expect(page.getByText(/upgrade required/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /manage plan/i })).toHaveAttribute("href", "/settings");

    // KPI cards from the real dashboard must not render.
    await expect(page.getByText(/^Occupancy$/)).toHaveCount(0);
    await expect(page.getByText(/^RevPAR$/)).toHaveCount(0);
  });

  test("professional unlocks 7d/30d but locks 90d and YTD", async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/analytics");

    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByText("Occupancy", { exact: true })).toBeVisible();

    const last7 = page.getByRole("button", { name: /last 7 days/i });
    const last30 = page.getByRole("button", { name: /last 30 days/i });
    const last90 = page.getByRole("button", { name: /last 90 days/i });
    const ytd = page.getByRole("button", { name: /year to date/i });

    await expect(last7).toBeEnabled();
    await expect(last30).toBeEnabled();
    await expect(last90).toBeDisabled();
    await expect(ytd).toBeDisabled();

    // Per-property breakdown is Business+, so the lock chip must show.
    await expect(page.getByText(/upgrade to .*business.* to see revenue split/i)).toBeVisible();
  });

  test("business unlocks every range and the property breakdown", async ({ page }) => {
    await installMocks(page, { plan: "business" });
    await page.goto("/analytics");

    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();

    for (const name of [/last 7 days/i, /last 30 days/i, /last 90 days/i, /year to date/i]) {
      await expect(page.getByRole("button", { name })).toBeEnabled();
    }

    // No upgrade prompt for the property breakdown.
    await expect(page.getByText(/upgrade to .*business.* to see revenue split/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /revenue by property/i })).toBeVisible();
  });

  test("enterprise also unlocks every range", async ({ page }) => {
    await installMocks(page, { plan: "enterprise" });
    await page.goto("/analytics");

    for (const name of [/last 7 days/i, /last 30 days/i, /last 90 days/i, /year to date/i]) {
      await expect(page.getByRole("button", { name })).toBeEnabled();
    }
  });
});
