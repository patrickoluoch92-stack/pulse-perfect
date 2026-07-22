import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("Dashboard Analytics", () => {
  test("should display dashboard overview for professional plan", async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/dashboard");

    await page.waitForLoadState("networkidle");

    // Check for main heading
    await expect(page.getByRole("heading", { name: /dashboard|overview/i })).toBeVisible();

    // Check for KPI cards
    await expect(page.getByText(/occupancy|revenue|bookings/i)).toBeVisible();
  });

  test("should show analytics charts", async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/analytics");

    await page.getByRole("heading", { name: "Analytics", level: 1 }).waitFor({ state: "visible" });

    // Check for chart containers
    const charts = page.locator("[class*='chart'], [class*='graph'], canvas");
    await expect(charts.first()).toBeVisible();
  });

  test("business plan shows all analytics features", async ({ page }) => {
    await installMocks(page, { plan: "business" });
    await page.goto("/analytics");

    // Wait for page to load
    await page.getByRole("heading", { name: "Analytics", level: 1 }).waitFor({ state: "visible" });

    // Check for property breakdown
    await expect(page.getByRole("heading", { name: /revenue by property/i })).toBeVisible();

    // Check for all date range buttons
    for (const range of ["7 days", "30 days", "90 days", "year to date"]) {
      await expect(page.getByRole("button", { name: new RegExp(range, "i") })).toBeEnabled();
    }
  });

  test("enterprise plan unlocks advanced features", async ({ page }) => {
    await installMocks(page, { plan: "enterprise" });
    await page.goto("/analytics");

    await page.getByRole("heading", { name: "Analytics", level: 1 }).waitFor({ state: "visible" });

    // Check for all advanced features enabled
    for (const range of ["7 days", "30 days", "90 days", "year to date"]) {
      await expect(page.getByRole("button", { name: new RegExp(range, "i") })).toBeEnabled();
    }

    // Should show property breakdown
    await expect(page.getByRole("heading", { name: /revenue by property/i })).toBeVisible();
  });
});

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "business" });
    await page.goto("/reports");
  });

  test("should display available reports", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
  });

  test("should generate occupancy report", async ({ page }) => {
    await page.getByRole("button", { name: /occupancy report/i }).click();

    // Select date range
    await page.getByLabel(/start date/i).fill("2026-05-01");
    await page.getByLabel(/end date/i).fill("2026-05-31");

    // Generate
    await page.getByRole("button", { name: /generate|download/i }).click();

    // Should show success
    await expect(page.getByText(/success|generated/i)).toBeVisible();
  });
});
