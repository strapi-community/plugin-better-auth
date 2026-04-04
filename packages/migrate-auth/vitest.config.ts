import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    pool: "threads",
    include: ["test/**/*.test.ts"],
  },
});
