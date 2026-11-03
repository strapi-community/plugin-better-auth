import { expect, test } from "@playwright/test";
import {
  createOrgWithOwner,
  createUser,
  isOrgTabVisible,
  navigateToDashboard,
  uniqueSuffix,
} from "./helpers";

/**
 * These tests require the better-auth `organization` plugin to be enabled.
 * The suite is skipped automatically when the tab is not visible.
 */
test.describe("Organizations page", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);

    if (!(await isOrgTabVisible(page))) {
      test.skip();
      return;
    }

    await page.getByTestId("nav-organizations").click();
    await expect(page.getByTestId("organizations-page")).toBeVisible();
  });

  // ── Page structure ─────────────────────────────────────────────────────────

  test("shows Organizations heading and create button", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Organizations" }),
    ).toBeVisible();
    await expect(page.getByTestId("create-org-btn")).toBeVisible();
  });

  test("shows empty state when no organizations exist", async ({ page }) => {
    const orgRows = page.getByTestId("org-row");
    const count = await orgRows.count();
    if (count === 0) {
      await expect(page.getByTestId("orgs-empty")).toBeVisible();
    }
  });

  test("shows table column headers", async ({ page }) => {
    await expect(page.getByText("Slug")).toBeVisible();
    await expect(page.getByText("Members")).toBeVisible();
  });

  // ── Create organization drawer ─────────────────────────────────────────────

  test("opens create organization drawer when button clicked", async ({
    page,
  }) => {
    await page.getByTestId("create-org-btn").click();
    await expect(
      page.getByRole("heading", { name: /create organization/i }),
    ).toBeVisible();
  });

  test("create drawer shows required fields", async ({ page }) => {
    await page.getByTestId("create-org-btn").click();
    await expect(page.getByPlaceholder("Acme Corp")).toBeVisible();
    await expect(page.getByPlaceholder("acme-corp")).toBeVisible();
    await expect(page.getByRole("combobox", { name: /owner/i })).toBeVisible();
  });

  test("create button is disabled when fields are empty", async ({ page }) => {
    await page.getByTestId("create-org-btn").click();
    await expect(page.getByTestId("create-org-submit")).toBeDisabled();
  });

  test("slug is auto-generated from the name", async ({ page }) => {
    await page.getByTestId("create-org-btn").click();
    await page.getByPlaceholder("Acme Corp").fill("Acme Corporation");
    const slugInput = page.getByPlaceholder("acme-corp");
    await expect(slugInput).toHaveValue("acme-corporation");
  });

  test("closes create drawer on Cancel", async ({ page }) => {
    await page.getByTestId("create-org-btn").click();
    await expect(
      page.getByRole("heading", { name: /create organization/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: /create organization/i }),
    ).not.toBeVisible();
  });

  test("closes create drawer on Close panel button", async ({ page }) => {
    await page.getByTestId("create-org-btn").click();
    await expect(
      page.getByRole("heading", { name: /create organization/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(
      page.getByRole("heading", { name: /create organization/i }),
    ).not.toBeVisible();
  });

  // ── Create organization flow ───────────────────────────────────────────────

  test("creates a new organization and shows it in the list", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const orgName = `Test Org ${suffix}`;
    const ownerEmail = `orgowner-${suffix}@example.com`;

    // Create the owner user first
    await page.getByTestId("nav-users").click();
    await expect(page.getByTestId("users-page")).toBeVisible();
    await createUser(page, `Org Owner ${suffix}`, ownerEmail);

    // Navigate to orgs and create
    await page.getByTestId("nav-organizations").click();
    await expect(page.getByTestId("organizations-page")).toBeVisible();
    await createOrgWithOwner(page, orgName, ownerEmail);
  });

  test("created organization row shows name and slug", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Slug Org ${suffix}`;
    const ownerEmail = `slugorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Slug Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const row = page.getByTestId("org-row").filter({ hasText: orgName });
    await expect(row).toBeVisible();
  });

  test("created org row shows edit and delete buttons", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Buttons Org ${suffix}`;
    const ownerEmail = `btnorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Btn Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const row = page.getByTestId("org-row").filter({ hasText: orgName });
    await expect(row.getByTestId("edit-org-btn")).toBeVisible();
    await expect(row.getByTestId("delete-org-btn")).toBeVisible();
  });

  // ── Edit organization ──────────────────────────────────────────────────────

  test("can edit an organization name", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Edit Org ${suffix}`;
    const updatedName = `Updated Org ${suffix}`;
    const ownerEmail = `editorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Edit Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    const nameInput = page.getByTestId("org-name-input");
    await nameInput.clear();
    await nameInput.fill(updatedName);
    await page.getByTestId("save-org-btn").click();
    // Drawer closes automatically after a successful save
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 });
  });

  // ── Delete organization ────────────────────────────────────────────────────

  test("shows delete confirmation dialog when delete clicked", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const orgName = `Del Confirm Org ${suffix}`;
    const ownerEmail = `delconfirmowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Del Confirm Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("delete-org-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete organization" }),
    ).toBeVisible();
  });

  test("cancelling delete keeps the organization in the list", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const orgName = `Cancel Del Org ${suffix}`;
    const ownerEmail = `canceldelowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Cancel Del Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("delete-org-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete organization" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText(orgName)).toBeVisible({ timeout: 5_000 });
  });

  test("confirming delete removes organization from list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Delete Org ${suffix}`;
    const ownerEmail = `delorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Del Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("delete-org-btn").click();

    await expect(
      page.getByRole("heading", { name: "Delete organization" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(orgName)).not.toBeVisible({ timeout: 10_000 });
  });

  // ── Bulk delete ────────────────────────────────────────────────────────────

  test("selecting organizations shows bulk delete button", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Bulk Select Org ${suffix}`;
    const ownerEmail = `bulkselectowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Bulk Select Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const row = page.getByTestId("org-row").filter({ hasText: orgName });
    await row.getByRole("checkbox").click();
    await expect(page.getByTestId("delete-selected-orgs-btn")).toBeVisible();
  });

  test("bulk delete removes selected organizations", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName1 = `Bulk Del Org1 ${suffix}`;
    const orgName2 = `Bulk Del Org2 ${suffix}`;
    const ownerEmail1 = `bulkdelowner1-${suffix}@example.com`;
    const ownerEmail2 = `bulkdelowner2-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Bulk Del Owner1 ${suffix}`, ownerEmail1);
    await createUser(page, `Bulk Del Owner2 ${suffix}`, ownerEmail2);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName1, ownerEmail1);
    await createOrgWithOwner(page, orgName2, ownerEmail2);

    const row1 = page.getByTestId("org-row").filter({ hasText: orgName1 });
    const row2 = page.getByTestId("org-row").filter({ hasText: orgName2 });
    await row1.getByRole("checkbox").click();
    await row2.getByRole("checkbox").click();

    await page.getByTestId("delete-selected-orgs-btn").click();
    await expect(
      page.getByRole("heading", { name: /Delete \d+ organizations?/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete all" }).click();

    await expect(page.getByText(orgName1)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(orgName2)).not.toBeVisible({ timeout: 10_000 });
  });

  // ── Organization detail drawer ─────────────────────────────────────────────

  test("organization detail drawer has expected tabs", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Tab Org ${suffix}`;
    const ownerEmail = `taborgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Tab Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    await expect(page.getByRole("tab", { name: "Details" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Members/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /SSO/ })).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
  });

  test("Members tab shows add member button", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Members Org ${suffix}`;
    const ownerEmail = `membersorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Members Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    await page.getByTestId("org-members-tab").click();
    await expect(page.getByTestId("add-member-btn")).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
  });

  test("Members tab shows owner as existing member", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Owner Member Org ${suffix}`;
    const ownerEmail = `ownermemberowner-${suffix}@example.com`;
    const ownerName = `Owner Member ${suffix}`;

    await page.getByTestId("nav-users").click();
    await createUser(page, ownerName, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    await page.getByTestId("org-members-tab").click();
    // The owner should appear as a member row
    await expect(page.getByTestId("member-row").first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Close panel" }).click();
  });

  test("Details tab shows org name and slug fields", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Details Org ${suffix}`;
    const ownerEmail = `detailsorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Details Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    await expect(page.getByTestId("org-name-input")).toBeVisible();
    await expect(page.getByTestId("org-slug-input")).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
  });

  test("Details tab name input is pre-populated", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `Prepop Org ${suffix}`;
    const ownerEmail = `prepopowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `Prepop Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    await expect(page.getByTestId("org-name-input")).toHaveValue(orgName);

    await page.getByRole("button", { name: "Close panel" }).click();
  });

  test("SSO tab is accessible", async ({ page }) => {
    const suffix = uniqueSuffix();
    const orgName = `SSO Org ${suffix}`;
    const ownerEmail = `ssoorgowner-${suffix}@example.com`;

    await page.getByTestId("nav-users").click();
    await createUser(page, `SSO Owner ${suffix}`, ownerEmail);

    await page.getByTestId("nav-organizations").click();
    await createOrgWithOwner(page, orgName, ownerEmail);

    const orgRow = page.getByTestId("org-row").filter({ hasText: orgName });
    await orgRow.getByTestId("edit-org-btn").click();

    // Click SSO tab — it should be visible without error
    await page.getByRole("tab", { name: /SSO/ }).click();
    await expect(page.getByTestId("org-detail-drawer")).toBeVisible();

    await page.getByRole("button", { name: "Close panel" }).click();
  });
});
