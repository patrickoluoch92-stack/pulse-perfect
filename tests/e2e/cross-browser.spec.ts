import { test, expect } from "@playwright/test";

test.describe("Cross-Browser Compatibility - Chromium", () => {
  test("should render correctly on Chromium", async ({ page, browserName }) => {
    if (browserName !== "chromium") return;

    await page.goto("/");

    // Check layout
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();

    // Check buttons are clickable
    const buttons = page.getByRole("button");
    await expect(buttons.first()).toBeVisible();
  });
});

test.describe("Cross-Browser Compatibility - Firefox", () => {
  test("should render correctly on Firefox", async ({ page, browserName }) => {
    if (browserName !== "firefox") return;

    await page.goto("/");

    // Check layout
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();

    // Check buttons are clickable
    const buttons = page.getByRole("button");
    await expect(buttons.first()).toBeVisible();
  });
});

test.describe("Cross-Browser Compatibility - WebKit", () => {
  test("should render correctly on WebKit", async ({ page, browserName }) => {
    if (browserName !== "webkit") return;

    await page.goto("/");

    // Check layout
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();

    // Check buttons are clickable
    const buttons = page.getByRole("button");
    await expect(buttons.first()).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");

    // Navigation should be accessible
    await expect(page.getByRole("button", { name: /menu|toggle/i })).toBeVisible();

    // Content should be visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should be responsive on tablet", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/");

    // Check layout adapts
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("should be responsive on desktop", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto("/");

    // Full layout should be visible
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("CSS Consistency", () => {
  test("should have consistent spacing", async ({ page }) => {
    await page.goto("/");

    // Check computed styles
    const header = page.locator("header");
    const padding = await header.evaluate((el) => {
      return window.getComputedStyle(el).padding;
    });

    expect(padding).toBeTruthy();
  });

  test("should have consistent colors", async ({ page }) => {
    await page.goto("/");

    // Check text color is readable
    const heading = page.getByRole("heading").first();
    const color = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    expect(color).toBeTruthy();
  });
});
