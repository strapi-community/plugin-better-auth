import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    pool: "threads",
    maxWorkers: 1,
    hookTimeout: 120000,
    // Some adapter-suite setup tests run a full migration (which reboots Strapi
    // twice), well beyond vitest's 5s default. Give every test generous headroom.
    testTimeout: 120000,
  },
});
