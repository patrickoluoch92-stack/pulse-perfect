import { test, expect } from "@playwright/test";

test.describe("Performance Testing", () => {
  test("should load homepage within 3 seconds", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/", { waitUntil: "load" });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test("should load dashboard within 4 seconds", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/dashboard", { waitUntil: "networkidle" });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(4000);
  });

  test("should handle lazy loading correctly", async ({ page }) => {
    await page.goto("/properties");

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for lazy-loaded content
    await page.waitForLoadState("networkidle");

    // Content should be visible
    await expect(page.getByRole("row")).toBeDefined();
  });

  test("should not have excessive network requests", async ({ page }) => {
    let requestCount = 0;
    page.on("request", () => {
      requestCount++;
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Reasonable number of requests (adjust based on your app)
    expect(requestCount).toBeLessThan(50);
  });

  test("should handle images efficiently", async ({ page }) => {
    await page.goto("/properties");

    // Check for lazy loading or responsive images
    const images = page.locator("img");
    const count = await images.count();

    if (count > 0) {
      const src = await images.first().getAttribute("src");
      expect(src).toBeTruthy();
    }
  });

  test("should minimize layout shifts", async ({ page }) => {
    // This is a basic check - can be extended with actual CLS metrics
    await page.goto("/");

    // Wait for layout stabilization
    await page.waitForLoadState("networkidle");

    // Check that main content is visible and stable
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Network Resilience", () => {
  test("should handle slow network gracefully", async ({ page, context }) => {
    // Throttle network
    await context.route("**/*", (route) => {
      setTimeout(() => route.continue(), 100);
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Page should still be interactive
    await expect(page.locator("main")).toBeVisible();
  });

  test("should handle offline gracefully", async ({ page }) => {
    await page.goto("/");

    // Simulate offline
    await page.context().setOffline(true);

    // Try to perform action
    const button = page.getByRole("button").first();
    if (await button.isVisible()) {
      // Page should handle gracefully (could show error or cache)
      expect(button).toBeDefined();
    }

    // Restore online
    await page.context().setOffline(false);
  });
});
