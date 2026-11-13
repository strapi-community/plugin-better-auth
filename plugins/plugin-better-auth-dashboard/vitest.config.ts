import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // Server integration tests only. The admin `*.spec.ts` files are Playwright
    // e2e tests (run via `test:e2e`) and must not be collected by Vitest.
    include: ["server/**/*.test.ts"],
    pool: "threads",
    maxWorkers: 1,
    hookTimeout: 120000,
  },
});
