import { expect, test } from "@playwright/test";
import {
  closeDrawer,
  createUser,
  navigateToDashboard,
  openUserDetail,
  uniqueSuffix,
} from "./helpers";

test.describe("User detail drawer", () => {
  let userEmail: string;
  let userName: string;

  test.beforeEach(async ({ page }) => {
    const suffix = uniqueSuffix();
    userName = `Detail User ${suffix}`;
    userEmail = `detail-${suffix}@example.com`;

    await navigateToDashboard(page);
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
    await createUser(page, userName, userEmail);
  });

  // ── Drawer opening ─────────────────────────────────────────────────────────

  test("opens user detail drawer when edit button clicked", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByTestId("user-detail-drawer")).toBeVisible();
  });

  test("drawer shows user email in header", async ({ page }) => {
    await openUserDetail(page, userEmail);
    // The drawer header contains the user's email
    await expect(page.getByTestId("user-detail-drawer")).toContainText(
      userEmail,
    );
  });

  // ── Tabs structure ─────────────────────────────────────────────────────────

  test("drawer has all expected tabs", async ({ page }) => {
    await openUserDetail(page, userEmail);
    const drawer = page.getByTestId("user-detail-drawer");
    await expect(drawer.getByRole("tab", { name: "Profile" })).toBeVisible();
    await expect(drawer.getByRole("tab", { name: "Security" })).toBeVisible();
    await expect(drawer.getByRole("tab", { name: "Sessions" })).toBeVisible();
    await expect(
      drawer.getByRole("tab", { name: "Organizations" }),
    ).toBeVisible();
  });

  test("Profile tab is active by default", async ({ page }) => {
    await openUserDetail(page, userEmail);
    // Profile tab content should be visible
    await expect(page.getByTestId("user-name-input")).toBeVisible();
  });

  test("can switch to Security tab", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Security" })
      .click();
    await expect(page.getByText("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
  });

  test("can switch to Sessions tab", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Sessions" })
      .click();
    await expect(page.getByText("Session management")).toBeVisible();
    await expect(page.getByText("Revoke all sessions")).toBeVisible();
  });

  test("can switch to Organizations tab", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Organizations" })
      .click();
    await expect(page.getByText("Memberships")).toBeVisible();
  });

  // ── Profile tab ────────────────────────────────────────────────────────────

  test("profile tab shows full name input pre-populated", async ({ page }) => {
    await openUserDetail(page, userEmail);
    const nameInput = page.getByTestId("user-name-input");
    await expect(nameInput).toHaveValue(userName);
  });

  test("save button is disabled when there are no edits", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByTestId("save-user-btn")).toBeDisabled();
  });

  test("editing name enables the save button", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page.getByTestId("user-name-input").fill("New Name");
    await expect(page.getByTestId("save-user-btn")).toBeEnabled();
  });

  test("discard button closes the drawer and drops edits", async ({ page }) => {
    await openUserDetail(page, userEmail);
    const nameInput = page.getByTestId("user-name-input");
    await nameInput.fill("Changed Name");
    await expect(page.getByTestId("save-user-btn")).toBeEnabled();

    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByTestId("user-detail-drawer")).not.toBeVisible();

    await openUserDetail(page, userEmail);
    await expect(nameInput).toHaveValue(userName);
    await expect(page.getByTestId("save-user-btn")).toBeDisabled();
  });

  test("saving closes the drawer", async ({ page }) => {
    const updatedName = `Updated ${uniqueSuffix()}`;
    await openUserDetail(page, userEmail);
    await page.getByTestId("user-name-input").fill(updatedName);
    await page.getByTestId("save-user-btn").click();

    await expect(page.getByTestId("user-detail-drawer")).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("updated name appears in the users list after saving", async ({
    page,
  }) => {
    const updatedName = `Updated ${uniqueSuffix()}`;
    await openUserDetail(page, userEmail);
    await page.getByTestId("user-name-input").fill(updatedName);
    await page.getByTestId("save-user-btn").click();

    await expect(page.getByTestId("user-detail-drawer")).not.toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
  });

  test("profile tab shows user metadata (User ID, Created)", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByText("User ID")).toBeVisible();
    await expect(
      page
        .getByTestId("user-detail-drawer")
        .getByText("Created", { exact: true }),
    ).toBeVisible();
  });

  test("profile tab shows email verified checkbox", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByLabel("Mark email as verified")).toBeVisible();
  });

  // ── Security tab ───────────────────────────────────────────────────────────

  test("security tab shows password section with set button disabled when empty", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Security" })
      .click();
    const setPasswordBtn = page.getByRole("button", { name: "Set password" });
    await expect(setPasswordBtn).toBeVisible();
    await expect(setPasswordBtn).toBeDisabled();
  });

  test("entering a password enables the set password button", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Security" })
      .click();
    await page.getByLabel("New password").fill("SomeStr0ng!Pass");
    await expect(
      page.getByRole("button", { name: "Set password" }),
    ).toBeEnabled();
  });

  test("security tab shows linked accounts section", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Security" })
      .click();
    await expect(page.getByText("Linked accounts")).toBeVisible();
    // New user has no OAuth providers linked
    await expect(page.getByText("No linked OAuth accounts.")).toBeVisible();
  });

  // ── Sessions tab ───────────────────────────────────────────────────────────

  test("sessions tab shows revoke all button", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Sessions" })
      .click();
    await expect(
      page.getByRole("button", { name: "Revoke all" }),
    ).toBeVisible();
  });

  test("sessions tab shows active sessions section", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Sessions" })
      .click();
    await expect(
      page.getByText("Active sessions", { exact: true }),
    ).toBeVisible();
    // New user created via admin has no sessions
    await expect(page.getByText("No active sessions.")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("clicking revoke all opens a confirmation dialog", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Sessions" })
      .click();
    await page.getByRole("button", { name: "Revoke all" }).click();
    await expect(
      page.getByRole("heading", { name: "Revoke all sessions" }),
    ).toBeVisible();
    // Cancel to clean up
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  // ── Organizations tab ──────────────────────────────────────────────────────

  test("organizations tab shows empty membership for new user", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    await page
      .getByTestId("user-detail-drawer")
      .getByRole("tab", { name: "Organizations" })
      .click();
    await expect(
      page.getByText("Not a member of any organizations."),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Closing the drawer ─────────────────────────────────────────────────────

  test("Close panel button closes the drawer", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByTestId("user-detail-drawer")).toBeVisible();
    await closeDrawer(page);
    await expect(page.getByTestId("user-detail-drawer")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("Escape key closes the drawer", async ({ page }) => {
    await openUserDetail(page, userEmail);
    await expect(page.getByTestId("user-detail-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("user-detail-drawer")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  // ── Ban tab (conditional) ──────────────────────────────────────────────────

  test("Ban tab shows ban form when the ban plugin is enabled", async ({
    page,
  }) => {
    await openUserDetail(page, userEmail);
    const drawer = page.getByTestId("user-detail-drawer");
    const banTab = drawer.getByRole("tab", { name: "Ban" });
    const hasBanTab = await banTab.isVisible();
    if (!hasBanTab) {
      test.skip();
      return;
    }
    await banTab.click();
    await expect(page.getByText("Apply ban")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ban user" })).toBeVisible();
  });
});
