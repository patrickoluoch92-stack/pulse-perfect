import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("User Settings", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/settings");
  });

  test("should display settings page", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /settings|profile/i })).toBeVisible();
  });

  test("should update profile information", async ({ page }) => {
    // Navigate to profile section
    await page.getByRole("link", { name: /profile/i }).click();

    // Update name
    await page.getByLabel(/full name/i).clear();
    await page.getByLabel(/full name/i).fill("Jane Smith");

    // Update phone
    await page.getByLabel(/phone/i).clear();
    await page.getByLabel(/phone/i).fill("+1 (555) 123-4567");

    // Save
    await page.getByRole("button", { name: /save|update/i }).click();

    // Should show success
    await expect(page.getByText(/success|updated/i)).toBeVisible();
  });

  test("should change password", async ({ page }) => {
    // Navigate to security section
    await page.getByRole("link", { name: /security|password/i }).click();

    // Fill password form
    await page.getByLabel(/current password/i).fill("oldpassword123");
    await page.getByLabel(/new password/i).fill("NewPassword456!");
    await page.getByLabel(/confirm password/i).fill("NewPassword456!");

    // Submit
    await page.getByRole("button", { name: /change|update|save/i }).click();

    // Should show success
    await expect(page.getByText(/success|changed/i)).toBeVisible();
  });

  test("should manage notification preferences", async ({ page }) => {
    // Navigate to notifications section
    await page.getByRole("link", { name: /notifications?/i }).click();

    // Toggle email notifications
    await page.getByLabel(/email notifications/i).check();

    // Save preferences
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success
    await expect(page.getByText(/success|updated/i)).toBeVisible();
  });
});

test.describe("Plan Management", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "starter" });
    await page.goto("/settings/plan");
  });

  test("should display current plan", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/current plan|starter/i)).toBeVisible();
  });

  test("should show upgrade options", async ({ page }) => {
    // Should display other plan options
    await expect(page.getByRole("button", { name: /upgrade to professional/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to business/i })).toBeVisible();
  });

  test("should initiate plan upgrade", async ({ page }) => {
    // Click upgrade button
    await page.getByRole("button", { name: /upgrade to professional/i }).click();

    // Should navigate to payment or confirmation
    await expect(page.getByRole("heading", { name: /upgrade|payment/i })).toBeVisible();
  });
});