import { test, expect } from "@playwright/test";
import { installMocks } from "./fixtures/mock-auth";

test.describe("Property Management", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/properties");
  });

  test("should display property list", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add property|new property/i })).toBeVisible();
  });

  test("should open create property modal", async ({ page }) => {
    await page.getByRole("button", { name: /add property|new property/i }).click();
    await expect(page.getByRole("heading", { name: /create|new property/i })).toBeVisible();
    await expect(page.getByLabel(/property name/i)).toBeVisible();
  });

  test("should create a new property", async ({ page }) => {
    await page.getByRole("button", { name: /add property|new property/i }).click();

    // Fill property form
    await page.getByLabel(/property name/i).fill("Beachfront Villa");
    await page.getByLabel(/address|location/i).fill("123 Ocean Drive");
    await page.getByLabel(/type/i).selectOption("house");
    await page.getByLabel(/bedrooms/i).fill("3");

    // Submit
    await page.getByRole("button", { name: /create|save/i }).click();

    // Should show success message or redirect
    await expect(page.getByText(/success|created/i)).toBeVisible();
  });

  test("should edit an existing property", async ({ page }) => {
    // Assuming there's a property in the list
    await page.getByRole("button", { name: /edit/i }).first().click();

    // Update property name
    await page.getByLabel(/property name/i).clear();
    await page.getByLabel(/property name/i).fill("Updated Property Name");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success
    await expect(page.getByText(/success|updated/i)).toBeVisible();
  });

  test("should delete a property with confirmation", async ({ page }) => {
    // Click delete button
    await page
      .getByRole("button", { name: /delete/i })
      .first()
      .click();

    // Confirm deletion
    await page.getByRole("button", { name: /confirm|yes|delete/i }).click();

    // Should show success
    await expect(page.getByText(/success|deleted/i)).toBeVisible();
  });
});

test.describe("Room Management", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page, { plan: "professional" });
    await page.goto("/properties/1/rooms");
  });

  test("should display rooms for a property", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /rooms/i })).toBeVisible();
  });

  test("should create a new room", async ({ page }) => {
    await page.getByRole("button", { name: /add room|new room/i }).click();

    await page.getByLabel(/room name/i).fill("Master Bedroom");
    await page.getByLabel(/type/i).selectOption("bedroom");
    await page.getByLabel(/occupancy/i).fill("2");
    await page.getByLabel(/price/i).fill("150");

    await page.getByRole("button", { name: /create|save/i }).click();

    await expect(page.getByText(/success|created/i)).toBeVisible();
  });
});
