import { expect, type Page } from "@playwright/test";

export const PLUGIN_URL = "/admin/plugins/better-auth-dashboard";

export const uniqueSuffix = () =>
  `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export async function navigateToDashboard(page: Page) {
  await page.goto(PLUGIN_URL);
  await expect(page.getByTestId("dashboard-root")).toBeVisible({
    timeout: 15_000,
  });
}

export async function navigateToUsers(page: Page) {
  await page.getByTestId("nav-users").click();
  await expect(page.getByTestId("users-page")).toBeVisible();
}

export async function createUser(
  page: Page,
  name: string,
  email: string,
  options?: { emailVerified?: boolean },
) {
  await page.getByTestId("create-user-btn").click();
  await expect(page.getByTestId("create-user-drawer")).toBeVisible();
  await page.getByTestId("new-user-name").fill(name);
  await page.getByTestId("new-user-email").fill(email);
  if (options?.emailVerified) {
    await page.getByLabel("Mark email as already verified").click();
  }
  await page.getByTestId("create-user-submit").click();
  await expect(page.getByTestId("create-user-drawer")).not.toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
}

export async function openUserDetail(page: Page, email: string) {
  const row = page.getByTestId("user-row").filter({ hasText: email });
  await row.getByTestId("edit-user-btn").click();
  await expect(page.getByTestId("user-detail-drawer")).toBeVisible();
}

export async function closeDrawer(page: Page) {
  await page.getByRole("button", { name: "Close panel" }).click();
}

export async function isOrgTabVisible(page: Page) {
  return page.getByTestId("nav-organizations").isVisible();
}

export async function createOrgWithOwner(
  page: Page,
  orgName: string,
  ownerEmail: string,
) {
  await page.getByTestId("create-org-btn").click();
  // Use placeholder to avoid strict-mode conflict with "Default team name" label
  await page.getByPlaceholder("Acme Corp").fill(orgName);
  // Open the combobox and pick the owner from the initial list (sorted by createdAt desc).
  // The user was just created so they appear at the top — no typing needed.
  await page.getByRole("combobox", { name: /owner/i }).click();
  await expect(
    page.getByRole("option", { name: new RegExp(ownerEmail, "i") }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("option", { name: new RegExp(ownerEmail, "i") }).click();
  await page.getByTestId("create-org-submit").click();
  await expect(page.getByTestId("create-org-submit")).not.toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(orgName)).toBeVisible({ timeout: 10_000 });
}
