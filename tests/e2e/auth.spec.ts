import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("User Registration Flow", () => {
  test("should complete registration successfully", async ({ page }) => {
    await page.goto("/");

    // Click register link
    await page.getByRole("link", { name: /register/i }).click();
    await page.waitForURL(/register/);

    // Fill registration form
    await page.getByLabel(/email/i).fill("newuser@example.com");
    await page.getByLabel(/password/i).first().fill("SecurePassword123!");
    await page.getByLabel(/confirm password/i).fill("SecurePassword123!");

    // Submit
    await page.getByRole("button", { name: /register/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("should show validation errors for invalid input", async ({ page }) => {
    await page.goto("/register");

    // Try to submit empty form
    await page.getByRole("button", { name: /register/i }).click();

    // Should show validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });
});

test.describe("User Login Flow", () => {
  test("should login successfully with valid credentials", async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/login");

    // Fill login form
    await page.getByLabel(/email/i).fill("tester@example.com");
    await page.getByLabel(/password/i).fill("password123");

    // Submit
    await page.getByRole("button", { name: /login/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill with invalid credentials
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");

    // Submit
    await page.getByRole("button", { name: /login/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });
});

test.describe("User Logout Flow", () => {
  test("should logout successfully", async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/dashboard");

    // Open user menu
    await page.getByRole("button", { name: /profile|menu/i }).first().click();

    // Click logout
    await page.getByRole("menuitem", { name: /logout/i }).click();

    // Should redirect to login
    await page.waitForURL(/login/);
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();
  });
});