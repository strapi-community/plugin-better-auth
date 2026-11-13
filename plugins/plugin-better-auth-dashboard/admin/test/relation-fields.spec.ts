import { expect, test } from "@playwright/test";
import {
  createOrgWithOwner,
  createUser,
  isOrgTabVisible,
  navigateToDashboard,
  openUserDetail,
  uniqueSuffix,
} from "./helpers";

test("USER panel shows an assigned relation custom field value", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const userName = `Rel User ${suffix}`;
  const userEmail = `rel-${suffix}@example.com`;

  await navigateToDashboard(page);
  await page.getByTestId("nav-users").click();
  await expect(page.getByTestId("users-page")).toBeVisible();
  await createUser(page, userName, userEmail);

  await openUserDetail(page, userEmail);
  const drawer = page.getByTestId("user-detail-drawer");

  const rolesCombobox = drawer.getByRole("combobox", { name: /roles/i });
  await rolesCombobox.click();
  await rolesCombobox.fill("Authenticated");
  await page.getByRole("option", { name: "Authenticated" }).click();

  await drawer.getByTestId("save-user-btn").click();
  await expect(drawer).not.toBeVisible({ timeout: 10_000 });

  // Re-open: the assigned relation value must be visible after a fresh load.
  await openUserDetail(page, userEmail);
  await expect(
    page.getByTestId("user-detail-drawer").getByText("Authenticated"),
  ).toBeVisible({ timeout: 10_000 });
});

test("ORGANIZATION panel shows an assigned relation custom field value", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const ownerName = `Org Owner ${suffix}`;
  const ownerEmail = `org-owner-${suffix}@example.com`;
  const orgName = `Rel Org ${suffix}`;

  await navigateToDashboard(page);
  if (!(await isOrgTabVisible(page))) {
    test.skip();
    return;
  }

  // An owner user is required to create an organization.
  await page.getByTestId("nav-users").click();
  await expect(page.getByTestId("users-page")).toBeVisible();
  await createUser(page, ownerName, ownerEmail);

  await page.getByTestId("nav-organizations").click();
  await expect(page.getByTestId("organizations-page")).toBeVisible();
  await createOrgWithOwner(page, orgName, ownerEmail);

  const openOrgDetail = async () => {
    const row = page.getByTestId("org-row").filter({ hasText: orgName });
    await row.getByTestId("edit-org-btn").click();
    await expect(page.getByTestId("org-detail-drawer")).toBeVisible();
  };

  // Assign a role through the Roles relation custom field (Details tab).
  await openOrgDetail();
  const drawer = page.getByTestId("org-detail-drawer");

  const rolesCombobox = drawer.getByRole("combobox", { name: /roles/i });
  await rolesCombobox.click();
  await rolesCombobox.fill("Authenticated");
  await page.getByRole("option", { name: "Authenticated" }).click();

  await drawer.getByTestId("save-org-btn").click();
  await expect(drawer).not.toBeVisible({ timeout: 10_000 });

  // Re-open: the assigned relation value must be visible after a fresh load.
  await openOrgDetail();
  await expect(
    page.getByTestId("org-detail-drawer").getByText("Authenticated"),
  ).toBeVisible({ timeout: 10_000 });
});
