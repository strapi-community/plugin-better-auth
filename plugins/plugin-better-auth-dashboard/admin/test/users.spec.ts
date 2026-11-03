import { expect, test } from "@playwright/test";
import { createUser, navigateToDashboard, uniqueSuffix } from "./helpers";

test.describe("Users page", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
  });

  // ── Page structure ─────────────────────────────────────────────────────────

  test("shows Users heading and create button", async ({ page }) => {
    await expect(page.getByText("Users").first()).toBeVisible();
    await expect(page.getByTestId("create-user-btn")).toBeVisible();
  });

  test("shows the user search input", async ({ page }) => {
    await expect(page.getByTestId("user-search")).toBeVisible();
  });

  test("shows table column headers", async ({ page }) => {
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("Status").first()).toBeVisible();
    await expect(
      page.getByRole("gridcell", { name: "Created", exact: true }),
    ).toBeVisible();
  });

  test("shows empty state when no users exist", async ({ page }) => {
    const empty = page.getByTestId("users-empty");
    const firstRow = page.getByTestId("user-row").first();
    // Wait for loading to finish — the spinner hides both rows and the empty state
    await expect(empty.or(firstRow)).toBeVisible({ timeout: 10_000 });

    const count = await page.getByTestId("user-row").count();
    if (count === 0) {
      await expect(empty).toBeVisible();
    }
  });

  // ── Create user drawer ─────────────────────────────────────────────────────

  test("opens create user drawer when button clicked", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("create-user-drawer")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create user" }),
    ).toBeVisible();
  });

  test("create drawer shows required fields", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("new-user-name")).toBeVisible();
    await expect(page.getByTestId("new-user-email")).toBeVisible();
  });

  test("create button is disabled when form is empty", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("create-user-submit")).toBeDisabled();
  });

  test("create button remains disabled with only name filled", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await page.getByTestId("new-user-name").fill("Test User");
    await expect(page.getByTestId("create-user-submit")).toBeDisabled();
  });

  test("create button is enabled with name and email filled", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await page.getByTestId("new-user-name").fill("Test User");
    await page.getByTestId("new-user-email").fill("test@example.com");
    await expect(page.getByTestId("create-user-submit")).toBeEnabled();
  });

  test("closes create drawer on Cancel", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("create-user-drawer")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("create-user-drawer")).not.toBeVisible();
  });

  test("closes create drawer on Close panel button", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("create-user-drawer")).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(page.getByTestId("create-user-drawer")).not.toBeVisible();
  });

  test("closes create drawer on Escape key", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByTestId("create-user-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("create-user-drawer")).not.toBeVisible();
  });

  // ── Password section ───────────────────────────────────────────────────────

  test("shows password field and generate password checkbox", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(page.getByLabel("Generate a random password")).toBeVisible();
    await expect(
      page.getByPlaceholder("Leave blank for a passwordless account"),
    ).toBeVisible();
  });

  test("checking generate password hides password input", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(
      page.getByPlaceholder("Leave blank for a passwordless account"),
    ).toBeVisible();
    await page.getByLabel("Generate a random password").click();
    await expect(
      page.getByPlaceholder("Leave blank for a passwordless account"),
    ).not.toBeVisible();
  });

  test("unchecking generate password shows password input again", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await page.getByLabel("Generate a random password").click();
    await expect(
      page.getByPlaceholder("Leave blank for a passwordless account"),
    ).not.toBeVisible();
    await page.getByLabel("Generate a random password").click();
    await expect(
      page.getByPlaceholder("Leave blank for a passwordless account"),
    ).toBeVisible();
  });

  // ── Email verification section ─────────────────────────────────────────────

  test("shows email verification checkboxes", async ({ page }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(
      page.getByLabel("Mark email as already verified"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Send a verification email to the user"),
    ).toBeVisible();
  });

  test("checking email verified hides send verification checkbox", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await expect(
      page.getByLabel("Send a verification email to the user"),
    ).toBeVisible();
    await page.getByLabel("Mark email as already verified").click();
    await expect(
      page.getByLabel("Send a verification email to the user"),
    ).not.toBeVisible();
  });

  test("checking email verified shows confirmation message", async ({
    page,
  }) => {
    await page.getByTestId("create-user-btn").click();
    await page.getByLabel("Mark email as already verified").click();
    await expect(
      page.getByText("The user will be able to sign in immediately"),
    ).toBeVisible();
  });

  // ── Create user flow ───────────────────────────────────────────────────────

  test("creates a new user and shows it in the list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Test User ${suffix}`;
    const email = `testuser-${suffix}@example.com`;

    await createUser(page, name, email);
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test("new user shows Unverified status chip by default", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `unverified-${suffix}@example.com`;

    await createUser(page, `Unverified ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await expect(row.getByText("Unverified", { exact: true })).toBeVisible();
  });

  test("new user with verified email shows Verified status chip", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `verified-${suffix}@example.com`;

    await createUser(page, `Verified ${suffix}`, email, {
      emailVerified: true,
    });
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await expect(row.getByText("Verified", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("created user row shows edit and delete buttons", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `buttons-${suffix}@example.com`;

    await createUser(page, `Buttons User ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await expect(row.getByTestId("edit-user-btn")).toBeVisible();
    await expect(row.getByTestId("delete-user-btn")).toBeVisible();
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  test("can search for a user by email", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `search-${suffix}@example.com`;

    await createUser(page, `Search User ${suffix}`, email);

    // Clear search and verify user found
    await page.getByTestId("user-search").fill(email);
    await page.keyboard.press("Enter");

    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });

  test("search with non-existent email shows empty state", async ({ page }) => {
    await page
      .getByTestId("user-search")
      .fill("doesnotexist-xyz-99999@example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("users-empty")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clearing search restores all users", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `restore-${suffix}@example.com`;
    await createUser(page, `Restore User ${suffix}`, email);

    // Search then clear
    await page.getByTestId("user-search").fill("doesnotexist-xyz@nope.com");
    await page.keyboard.press("Enter");
    await page.getByTestId("user-search").fill("");
    await page.keyboard.press("Enter");

    // The user should come back
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  test("shows delete confirmation dialog when delete clicked", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `delete-confirm-${suffix}@example.com`;

    await createUser(page, `Delete Confirm ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await row.getByTestId("delete-user-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete user" }),
    ).toBeVisible();
    await expect(page.getByText("This action cannot be undone")).toBeVisible();
  });

  test("cancelling delete keeps the user in the list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `cancel-delete-${suffix}@example.com`;

    await createUser(page, `Cancel Delete ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await row.getByTestId("delete-user-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete user" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // User should still be in list
    await expect(page.getByText(email)).toBeVisible({ timeout: 5_000 });
  });

  test("confirming delete removes user from list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `delete-user-${suffix}@example.com`;

    await createUser(page, `Delete User ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await row.getByTestId("delete-user-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete user" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(email)).not.toBeVisible({ timeout: 10_000 });
  });

  // ── Bulk delete ────────────────────────────────────────────────────────────

  test("selecting users shows bulk delete button", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `bulk-select-${suffix}@example.com`;

    await createUser(page, `Bulk Select ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });
    await row.getByRole("checkbox").click();

    await expect(page.getByTestId("delete-selected-btn")).toBeVisible();
  });

  test("bulk delete button is hidden when no selection", async ({ page }) => {
    await expect(page.getByTestId("delete-selected-btn")).not.toBeVisible();
  });

  test("bulk delete shows confirmation with count", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email1 = `bulk-count1-${suffix}@example.com`;
    const email2 = `bulk-count2-${suffix}@example.com`;

    await createUser(page, `Bulk Count1 ${suffix}`, email1);
    await createUser(page, `Bulk Count2 ${suffix}`, email2);

    const row1 = page.getByTestId("user-row").filter({ hasText: email1 });
    const row2 = page.getByTestId("user-row").filter({ hasText: email2 });
    await row1.getByRole("checkbox").click();
    await row2.getByRole("checkbox").click();

    await page.getByTestId("delete-selected-btn").click();
    await expect(
      page.getByRole("heading", { name: /Delete \d+ users?/ }),
    ).toBeVisible();
  });

  test("bulk delete removes all selected users", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email1 = `bulk-del1-${suffix}@example.com`;
    const email2 = `bulk-del2-${suffix}@example.com`;

    await createUser(page, `Bulk Del1 ${suffix}`, email1);
    await createUser(page, `Bulk Del2 ${suffix}`, email2);

    const row1 = page.getByTestId("user-row").filter({ hasText: email1 });
    const row2 = page.getByTestId("user-row").filter({ hasText: email2 });
    await row1.getByRole("checkbox").click();
    await row2.getByRole("checkbox").click();

    await page.getByTestId("delete-selected-btn").click();
    await expect(
      page.getByRole("heading", { name: /Delete \d+ users?/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete all" }).click();

    await expect(page.getByText(email1)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(email2)).not.toBeVisible({ timeout: 10_000 });
  });

  test("deselecting users hides the bulk delete button", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `deselect-${suffix}@example.com`;

    await createUser(page, `Deselect ${suffix}`, email);
    const row = page.getByTestId("user-row").filter({ hasText: email });

    // Select then deselect
    await row.getByRole("checkbox").click();
    await expect(page.getByTestId("delete-selected-btn")).toBeVisible();
    await row.getByRole("checkbox").click();
    await expect(page.getByTestId("delete-selected-btn")).not.toBeVisible();
  });
});
