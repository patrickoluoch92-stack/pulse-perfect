import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("Booking Management", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/bookings");
  });

  test("should display bookings list", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /bookings/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /new booking|add booking/i })).toBeVisible();
  });

  test("should create a new booking", async ({ page }) => {
    await page.getByRole("button", { name: /new booking|add booking/i }).click();

    // Fill booking form
    await page.getByLabel(/property/i).selectOption("1");
    await page.getByLabel(/guest name/i).fill("John Doe");
    await page.getByLabel(/email/i).fill("john@example.com");
    await page.getByLabel(/check-in/i).fill("2026-06-15");
    await page.getByLabel(/check-out/i).fill("2026-06-20");
    await page.getByLabel(/status/i).selectOption("confirmed");

    // Submit
    await page.getByRole("button", { name: /create|save/i }).click();

    // Should show success
    await expect(page.getByText(/success|created/i)).toBeVisible();
  });

  test("should cancel a booking", async ({ page }) => {
    // Click on a booking
    await page.getByRole("row").first().click();

    // Click cancel button
    await page.getByRole("button", { name: /cancel booking/i }).click();

    // Confirm cancellation
    await page.getByRole("button", { name: /confirm|yes|cancel/i }).click();

    // Should show success
    await expect(page.getByText(/cancelled|success/i)).toBeVisible();
  });

  test("should filter bookings by status", async ({ page }) => {
    // Click filter button
    await page.getByRole("button", { name: /filter|status/i }).click();

    // Select confirmed status
    await page.getByLabel(/confirmed/i).check();

    // Apply filter
    await page.getByRole("button", { name: /apply|filter/i }).click();

    // Should show only confirmed bookings
    await page.waitForLoadState("networkidle");
    const rows = page.getByRole("row");
    await expect(rows).toContainText(/confirmed/);
  });
});

test.describe("Guest Management", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/guests");
  });

  test("should display guests list", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /guests/i })).toBeVisible();
  });

  test("should view guest details", async ({ page }) => {
    // Click on a guest
    await page.getByRole("row").first().click();

    // Should show guest details
    await expect(page.getByRole("heading", { name: /guest details/i })).toBeVisible();
    await expect(page.getByText(/email/i)).toBeVisible();
    await expect(page.getByText(/phone/i)).toBeVisible();
  });

  test("should add guest note", async ({ page }) => {
    // Click on a guest
    await page.getByRole("row").first().click();

    // Add note
    await page.getByLabel(/notes/i).fill("VIP guest - prefers early check-in");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success
    await expect(page.getByText(/success|saved/i)).toBeVisible();
  });
});
