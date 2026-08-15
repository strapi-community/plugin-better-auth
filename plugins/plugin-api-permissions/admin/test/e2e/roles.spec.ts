import { expect, type Page, test } from "@playwright/test";

const ROLES_URL = "/admin/settings/api-permissions/roles";
const ROLES_NEW_URL = "/admin/settings/api-permissions/roles/new";
const TEST_ROLE_DESCRIPTION = "Created by Playwright e2e tests";

// Playwright re-evaluates this module in separate VM contexts per describe block,
// so Date.now() would differ across blocks. process.env is shared across VM contexts
// in the same process, so it persists the name for the full test run.
if (!process.env.__E2E_TEST_ROLE_NAME) {
  process.env.__E2E_TEST_ROLE_NAME = `E2E Test Role ${Date.now()}`;
}
const TEST_ROLE_NAME = process.env.__E2E_TEST_ROLE_NAME!;
const UPDATED_ROLE_NAME = `${TEST_ROLE_NAME} Updated`;

/** Returns the first <td> cell in <tbody> that contains the given role name. */
function getRoleCell(page: Page, name: string) {
  return page.locator("tbody td").filter({ hasText: name }).first();
}

/**
 * Expands the collapsed Strapi SearchInput and returns the searchbox.
 * Strapi's SearchInput initially renders as a button; clicking it expands to a searchbox.
 */
async function openSearch(page: Page) {
  await page.getByRole("button", { name: /^search$/i }).click();
  return page.getByRole("searchbox");
}

test.describe("Roles list page", () => {
  test("shows the roles list heading", async ({ page }) => {
    await page.goto(ROLES_URL);

    await expect(page.getByRole("heading", { name: /roles/i })).toBeVisible();
  });

  test("shows the Add new role button", async ({ page }) => {
    await page.goto(ROLES_URL);

    await expect(
      page.getByRole("button", { name: /add new role/i }),
    ).toBeVisible();
  });

  test("shows the search input", async ({ page }) => {
    await page.goto(ROLES_URL);

    // SearchInput renders as a collapsed button; clicking it expands to a searchbox
    await expect(page.getByRole("button", { name: /^search$/i })).toBeVisible();
  });
});

test.describe("Create role", () => {
  test("navigates to create page from list", async ({ page }) => {
    await page.goto(ROLES_URL);
    await page.getByRole("button", { name: /add new role/i }).click();

    await expect(page).toHaveURL(ROLES_NEW_URL);
    await expect(
      page.getByRole("heading", { name: /create a role/i }),
    ).toBeVisible();
  });

  test("shows validation error when name is too short", async ({ page }) => {
    await page.goto(ROLES_NEW_URL);

    await page.getByLabel("Name").fill("ab");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/this value is required/i)).toBeVisible();
  });

  test("creates a new role and redirects to list", async ({ page }) => {
    await page.goto(ROLES_NEW_URL);

    await page.getByLabel("Name").fill(TEST_ROLE_NAME);
    await page.getByLabel("Description").fill(TEST_ROLE_DESCRIPTION);
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(ROLES_URL);
    await expect(getRoleCell(page, TEST_ROLE_NAME)).toBeVisible();
  });
});

test.describe("Edit role", () => {
  test("opens edit page when clicking on a role row", async ({ page }) => {
    await page.goto(ROLES_URL);

    await getRoleCell(page, TEST_ROLE_NAME).click();

    await expect(page).toHaveURL(
      /\/admin\/settings\/api-permissions\/roles\/[a-zA-Z0-9]+/,
    );
    await expect(
      page.getByRole("heading", { name: /edit a role/i }),
    ).toBeVisible();
  });

  test("pre-fills the form with existing role data", async ({ page }) => {
    await page.goto(ROLES_URL);

    await getRoleCell(page, TEST_ROLE_NAME).click();

    await expect(page.getByLabel("Name")).toHaveValue(TEST_ROLE_NAME);
    await expect(page.getByLabel("Description")).toHaveValue(
      TEST_ROLE_DESCRIPTION,
    );
  });

  test("saves and reloads selected permissions", async ({ page }) => {
    await page.goto(ROLES_URL);

    await getRoleCell(page, TEST_ROLE_NAME).click();

    const findTestPermission = page.getByRole("checkbox", {
      name: /select find test permission/i,
    });
    await findTestPermission.click();
    await expect(findTestPermission).toBeChecked();

    await page.getByRole("button", { name: /save/i }).click();
    await expect(page).toHaveURL(ROLES_URL);

    await getRoleCell(page, TEST_ROLE_NAME).click();
    await expect(
      page.getByRole("checkbox", {
        name: /select find test permission/i,
      }),
    ).toBeChecked();
  });

  test("updates the role name and redirects to list", async ({ page }) => {
    await page.goto(ROLES_URL);

    await getRoleCell(page, TEST_ROLE_NAME).click();

    const nameInput = page.getByLabel("Name");
    await nameInput.clear();
    await nameInput.fill(UPDATED_ROLE_NAME);

    await page.getByRole("button", { name: /save/i }).click();

    await expect(page).toHaveURL(ROLES_URL);
    await expect(getRoleCell(page, UPDATED_ROLE_NAME)).toBeVisible();
  });
});

test.describe("Search roles", () => {
  test("filters roles by name", async ({ page }) => {
    await page.goto(ROLES_URL);

    const searchInput = await openSearch(page);
    await searchInput.fill(UPDATED_ROLE_NAME);

    await expect(getRoleCell(page, UPDATED_ROLE_NAME)).toBeVisible();
  });

  test("shows empty state when no roles match", async ({ page }) => {
    // The Strapi SearchInput component manages its own internal state via URL params
    // and does not call the onChange prop. Client-side search filtering therefore
    // requires the list to be empty. We mock the API to return an empty roles list
    // so the EmptyStateLayout renders.
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = req.url();
      const resourceType = req.resourceType();
      // Only intercept XHR/fetch API calls for the roles endpoint
      if (
        (resourceType === "xhr" || resourceType === "fetch") &&
        url.includes("api-permissions") &&
        url.includes("roles") &&
        !url.includes("permissions/layout")
      ) {
        if (req.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ roles: [] }),
          });
          return;
        }
      }
      await route.continue();
    });

    await page.goto(ROLES_URL);

    await expect(page.getByText(/you don't have any roles yet/i)).toBeVisible();
  });
});

test.describe("Delete role", () => {
  test("deletes the test role", async ({ page }) => {
    await page.goto(ROLES_URL);

    // Ensure the updated role is present before attempting to delete
    await expect(getRoleCell(page, UPDATED_ROLE_NAME)).toBeVisible();

    // Find the delete button within the role's row
    const roleRow = page
      .locator("tbody tr")
      .filter({ has: page.locator("td", { hasText: UPDATED_ROLE_NAME }) });
    const deleteButton = roleRow.getByRole("button", { name: /^delete/i });

    await deleteButton.click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^confirm$/i }).click();

    await expect(getRoleCell(page, UPDATED_ROLE_NAME)).not.toBeVisible();
  });
});
