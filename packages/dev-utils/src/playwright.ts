import { join } from "node:path";
import { defineConfig, devices, expect, test as setup } from "@playwright/test";
import { setupDb } from "./db";

export function createPlaywrightConfig(options: { testDir: string }) {
  const PORT = process.env.STRAPI_PORT ?? String(10000 + (process.pid % 50000));
  const baseURL =
    process.env.PLAYWRIGHT_TEST_BASE_URL ??
    process.env.STRAPI_BASE_URL ??
    `http://localhost:${PORT}`;
  process.env.PLAYWRIGHT_TEST_BASE_URL ??= baseURL;

  const dbEnv = setupDb(String(process.pid));

  // The app under test, e.g. `playground` (native ids) or `playground-serial`.
  const app = process.env.PLAYGROUND ?? "playground";

  return defineConfig({
    testDir: options.testDir,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 10,
    reporter: "html",
    use: {
      baseURL,
      trace: "on-first-retry",
      screenshot: "only-on-failure",
    },
    webServer: {
      command: `cd ../../apps/${app}/ && pnpm run ${process.env.CI ? "start" : "dev"}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PORT,
        APP_KEYS: "test-app-key-1,test-app-key-2,test-app-key-3,test-app-key-4",
        API_TOKEN_SALT: "test-api-token-salt",
        ADMIN_JWT_SECRET: "test-admin-jwt-secret",
        TRANSFER_TOKEN_SALT: "test-transfer-token-salt",
        ENCRYPTION_KEY: "test-encryption-key-1234567890",
        JWT_SECRET: "test-jwt-secret",
        BETTER_AUTH_URL: baseURL,
        STRAPI_URL: `http://localhost:${PORT}`,
        ...dbEnv,
      },
      // Strapi logs "Strapi started successfully" to stdout after the HTTP server
      // is fully ready (including after any hot-reload recompile).
      wait: {
        stdout: /Strapi started successfully/,
      },
    },
    projects: [
      {
        name: "setup",
        testMatch: "**/setup/auth.setup.ts",
      },
      {
        name: "chromium",
        use: {
          ...devices["Desktop Chrome"],
          storageState: `${options.testDir}/.auth/user.json`,
        },
        dependencies: ["setup"],
      },
    ],
  });
}

export function registerAuthSetup(authFilePath: string) {
  setup("authenticate", async ({ page }) => {
    await page.goto("/admin/auth/login");

    await page.getByLabel("First name").fill("John");
    await page.getByLabel("Email").fill("johndoe@example.com");
    await page.getByLabel("Password*", { exact: true }).fill("Abc12345678");
    await page
      .getByLabel("Confirm Password*", { exact: true })
      .fill("Abc12345678");

    await page.getByRole("button", { name: /let's start/i }).click();

    await expect(page).toHaveURL(/\/admin(?!\/auth)/);

    await page.context().storageState({ path: authFilePath });
  });
}
