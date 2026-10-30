import { expect, test } from "@playwright/test";
import { PLUGIN_URL } from "./helpers";

test.describe("Overview page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PLUGIN_URL);
    await expect(page.getByTestId("dashboard-root")).toBeVisible();
    await expect(page.getByTestId("overview-page")).toBeVisible();
  });

  // ── Structure ──────────────────────────────────────────────────────────────

  test("shows the Overview heading", async ({ page }) => {
    await expect(page.getByText("Overview").first()).toBeVisible();
  });

  test("shows all three period pills", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Daily" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Weekly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Monthly" })).toBeVisible();
  });

  test("shows Metrics section divider", async ({ page }) => {
    await expect(page.getByText("Metrics")).toBeVisible();
  });

  // Use exact: true — "Growth" is a substring of "User Growth"
  test("shows Growth section divider", async ({ page }) => {
    await expect(page.getByText("Growth", { exact: true })).toBeVisible();
  });

  test("shows Retention & Activity section divider", async ({ page }) => {
    await expect(page.getByText("Retention & Activity")).toBeVisible();
  });

  // ── Metrics stat cards ─────────────────────────────────────────────────────

  test("shows Total Users stat card", async ({ page }) => {
    await expect(page.getByText("Total Users")).toBeVisible();
  });

  test("shows sign-up stat cards", async ({ page }) => {
    await expect(page.getByText("Daily Sign-ups")).toBeVisible();
    await expect(page.getByText("Weekly Sign-ups")).toBeVisible();
    await expect(page.getByText("Monthly Sign-ups")).toBeVisible();
  });

  // Scope to the overview page to avoid matching the nav Organizations tab
  test("shows Organizations stat card", async ({ page }) => {
    await expect(
      page
        .getByTestId("overview-page")
        .getByText("Organizations", { exact: true }),
    ).toBeVisible();
  });

  // ── Active user ring cards ─────────────────────────────────────────────────

  test("shows active user ring cards", async ({ page }) => {
    await expect(page.getByText("Daily Active")).toBeVisible();
    await expect(page.getByText("Weekly Active")).toBeVisible();
    await expect(page.getByText("Monthly Active")).toBeVisible();
  });

  // ── User Growth chart ──────────────────────────────────────────────────────

  test("shows User Growth chart title", async ({ page }) => {
    await expect(page.getByText("User Growth")).toBeVisible();
  });

  test("shows the user growth SVG chart", async ({ page }) => {
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible();
  });

  test("shows chart series toggle buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Total" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
  });

  test("shows hover instruction text on the chart", async ({ page }) => {
    await expect(
      page.getByText("Hover the chart to inspect a data point"),
    ).toBeVisible();
  });

  // ── Period switching ───────────────────────────────────────────────────────

  test("clicking Daily pill keeps chart visible", async ({ page }) => {
    await page.getByRole("button", { name: "Daily" }).click();
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Total Users")).toBeVisible();
  });

  test("clicking Monthly pill keeps chart visible", async ({ page }) => {
    await page.getByRole("button", { name: "Monthly" }).click();
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Total Users")).toBeVisible();
  });

  test("cycling through all periods keeps chart stable", async ({ page }) => {
    for (const period of ["Daily", "Weekly", "Monthly"]) {
      await page.getByRole("button", { name: period }).click();
      await expect(
        page.getByRole("img", { name: "User growth chart" }),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Chart series toggle ────────────────────────────────────────────────────

  test("toggling a series button keeps chart visible", async ({ page }) => {
    await page.getByRole("button", { name: "New" }).click();
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New" }).click();
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible();
  });

  test("toggling all but one series still renders the chart", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Total" }).click();
    await page.getByRole("button", { name: "Active" }).click();
    await expect(
      page.getByRole("img", { name: "User growth chart" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Total" }).click();
    await page.getByRole("button", { name: "Active" }).click();
  });

  // ── Feed card ──────────────────────────────────────────────────────────────

  test("shows Recent Sign-ups feed by default", async ({ page }) => {
    await expect(page.getByText("Recent Sign-ups").first()).toBeVisible();
  });

  test("can switch feed mode to Recently Active", async ({ page }) => {
    await page.getByRole("combobox", { name: "Feed" }).click();
    await page.getByRole("option", { name: "Recently Active" }).click();
    await expect(page.getByText("Recently Active").first()).toBeVisible();
  });

  test("switching feed back to Recent Sign-ups works", async ({ page }) => {
    await page.getByRole("combobox", { name: "Feed" }).click();
    await page.getByRole("option", { name: "Recently Active" }).click();
    await expect(page.getByText("Recently Active").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Feed" }).click();
    await page.getByRole("option", { name: "Recent Sign-ups" }).click();
    await expect(page.getByText("Recent Sign-ups").first()).toBeVisible();
  });

  // ── Retention ─────────────────────────────────────────────────────────────

  test("shows Cohort Retention section title", async ({ page }) => {
    await expect(page.getByText("Cohort Retention")).toBeVisible();
  });

  test("renders without errors on empty database", async ({ page }) => {
    await expect(page.getByTestId("overview-page")).toBeVisible();
    await expect(page.getByText("Total Users")).toBeVisible();
    await expect(page.getByText("Overview").first()).toBeVisible();
  });
});
