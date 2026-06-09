import { test as setup } from "@playwright/test";

/**
 * Global setup for authentication state persistence.
 * This runs once before all tests and saves the auth state for reuse.
 */
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Visit the app
  await page.goto("/");

  // Wait for authentication to complete
  // In production, you would perform actual login here
  // For now, we're relying on mock-auth fixtures in individual tests
  await page.waitForLoadState("networkidle");

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE });
});