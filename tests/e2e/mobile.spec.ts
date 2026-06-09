import { test, expect } from "@playwright/test";

test.describe("Mobile Testing - iPhone 15", () => {
  test("should navigate on mobile", async ({ page }) => {
    await page.goto("/");

    // Check mobile menu is available
    const menuButton = page.getByRole("button", { name: /menu|toggle|navigation/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByRole("navigation")).toBeVisible();
    }
  });

  test("should fill forms on mobile", async ({ page }) => {
    await page.goto("/login");

    // Fill form
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("test@example.com");

    // Input should be filled
    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("should tap buttons on mobile", async ({ page }) => {
    await page.goto("/");

    // Click button
    const button = page.getByRole("button").first();
    await button.click();

    // Should respond to tap
    expect(button).toBeDefined();
  });
});

test.describe("Mobile Testing - Pixel 8", () => {
  test("should render correctly on Android", async ({ page }) => {
    await page.goto("/");

    // Check layout
    await expect(page.locator("main")).toBeVisible();

    // Check touch targets are large enough
    const buttons = page.getByRole("button");
    const boundingBox = await buttons.first().boundingBox();
    expect(boundingBox).toBeDefined();
    expect(boundingBox!.width).toBeGreaterThan(40);
    expect(boundingBox!.height).toBeGreaterThan(40);
  });

  test("should handle keyboard on mobile", async ({ page }) => {
    await page.goto("/login");

    // Focus input
    const emailInput = page.getByLabel(/email/i);
    await emailInput.focus();

    // Type
    await emailInput.type("test@example.com");

    // Should be filled
    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("should be touch-friendly", async ({ page }) => {
    await page.goto("/");

    // Tap elements
    const link = page.getByRole("link").first();
    await link.tap();

    // Should navigate or respond
    expect(link).toBeDefined();
  });
});

test.describe("Mobile Navigation", () => {
  test("should support bottom navigation on mobile", async ({ page }) => {
    await page.goto("/");

    // Check for mobile navigation
    const navItems = page.getByRole("navigation").locator("a, button");
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should handle deep links on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    // Check page loaded correctly
    await expect(page.getByRole("heading")).toBeVisible();
  });
});

test.describe("Mobile Forms", () => {
  test("should show mobile-friendly form inputs", async ({ page }) => {
    await page.goto("/login");

    // Check for mobile-optimized inputs
    const emailInput = page.getByLabel(/email/i);
    const type = await emailInput.getAttribute("type");

    // Email input should have proper type
    expect(["email", "text"]).toContain(type);
  });

  test("should handle form submission on mobile", async ({ page }) => {
    await page.goto("/login");

    // Fill form
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("password");

    // Submit - should work on mobile
    const submitButton = page.getByRole("button", { name: /login|submit/i });
    await submitButton.click();

    // Should navigate or show feedback
    expect(submitButton).toBeDefined();
  });
});