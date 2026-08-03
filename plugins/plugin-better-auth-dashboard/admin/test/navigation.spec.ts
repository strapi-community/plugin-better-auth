import { expect, test } from "@playwright/test";
import { PLUGIN_URL } from "./helpers";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PLUGIN_URL);
  });

  test("renders the dashboard container", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
  });

  test("shows Better Auth branding header", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByText("Authentication")).toBeVisible();
  });

  test("shows the main navigation tab list", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByTestId("main-nav")).toBeVisible();
  });

  test("navigation includes Overview and Users tabs", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByTestId("nav-overview")).toBeVisible();
    await expect(page.getByTestId("nav-users")).toBeVisible();
  });

  test("defaults to Overview tab on load", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByTestId("overview-page")).toBeVisible();
    await expect(page.getByTestId("users-page")).not.toBeVisible();
  });

  test("navigates to Users tab when clicked", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
    await expect(page.getByTestId("overview-page")).not.toBeVisible();
  });

  test("navigates back to Overview from Users", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
    await page.getByTestId("nav-overview").click();
    await expect(page.getByTestId("overview-page")).toBeVisible();
    await expect(page.getByTestId("users-page")).not.toBeVisible();
  });

  test("Organizations tab navigates to organizations page when visible", async ({
    page,
  }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    const orgTab = page.getByTestId("nav-organizations");
    const isVisible = await orgTab.isVisible();
    if (!isVisible) {
      test.skip();
      return;
    }
    await orgTab.click();
    await expect(page.getByTestId("organizations-page")).toBeVisible();
  });

  test("tab content area renders for overview tab", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByTestId("overview-page")).toBeVisible();
  });

  test("tab content area renders for users tab", async ({ page }) => {
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
  });
});
