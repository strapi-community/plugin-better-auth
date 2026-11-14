import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  authFlowTestSuite,
  caseInsensitiveTestSuite,
  numberIdTestSuite,
  testAdapter,
} from "@better-auth/test-utils/adapter";
import {
  cleanupDir,
  playgroundDir,
  setupStrapi,
  stopStrapi,
} from "@strapi-community/dev-utils";
import { getAuthTables } from "better-auth/db";
import { afterAll } from "vitest";
import { strapiAdapter } from "../src/adapter";
import { updateStrapiSchema } from "../src/adapter/transformers";

// The migrations below regenerate the playground's content types from the test
// suite's own Better Auth config. Back them up so other test files still boot
// against the playground's real schema.
const contentTypesDir = path.join(
  playgroundDir,
  "src/extensions/better-auth/content-types",
);
const contentTypesBackupDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "better-auth-content-types-"),
);
await fs.cp(contentTypesDir, contentTypesBackupDir, { recursive: true });

/**
 * Drops the Better Auth tables, so the next boot creates them from scratch.
 *
 * Each migration below is a different Better Auth config rather than an upgrade
 * of the previous one. Strapi's schema sync can't move foreign keys between
 * such unrelated schemas (e.g. a reference whose target table was renamed).
 * Strapi's own tables are kept, as the app is still running.
 */
async function resetBetterAuthTables() {
  const prefix = strapi.config.get("plugin::better-auth.table_prefix", "ba_");
  const isBetterAuthTable = (name: string) => name.startsWith(prefix);
  const { tables } = await strapi.db.dialect.schemaInspector.getSchema();

  await strapi.db.dialect.startSchemaUpdate();
  try {
    // SQLite doesn't enforce foreign keys during a schema update, so only
    // Postgres and MySQL need them dropped before the tables they point at.
    if (strapi.db.dialect.usesForeignKeys()) {
      for (const table of tables) {
        const foreignKeys = table.foreignKeys.filter(
          (fk) =>
            isBetterAuthTable(table.name) ||
            isBetterAuthTable(fk.referencedTable),
        );
        if (foreignKeys.length === 0) continue;

        await strapi.db.getSchemaConnection().alterTable(table.name, (t) => {
          for (const fk of foreignKeys) t.dropForeign(fk.columns, fk.name);
        });
      }
    }
    for (const table of tables.filter((t) => isBetterAuthTable(t.name))) {
      await strapi.db.getSchemaConnection().dropTableIfExists(table.name);
    }
    // Forget the stored schema, so the next boot syncs even when the schema
    // itself is unchanged and recreates the dropped tables.
    await strapi.db.getConnection("strapi_database_schema").delete();
  } finally {
    await strapi.db.dialect.endSchemaUpdate();
  }
}

const { execute } = await testAdapter({
  adapter: (_options) => {
    return strapiAdapter() as never;
  },
  overrideBetterAuthOptions: (options) => ({
    ...options,
    advanced: {
      ...options.advanced,
      database: {
        ...options.advanced?.database,
        generateId: "serial",
      },
    },
  }),
  runMigrations: async (opts) => {
    const authTables = getAuthTables(opts);
    // Remove stale compiled extension artifacts so Strapi loads fresh schema JSON.
    await cleanupDir(path.join(playgroundDir, "dist"));

    // Start up Strapi and run the schema updates.
    await setupStrapi();

    // Update Strapi schemas based on Better Auth configuration.
    await updateStrapiSchema(strapi, authTables);

    await resetBetterAuthTables();

    // Restart Strapi in order to load the new schemas before running tests.
    await stopStrapi();
    await setupStrapi();
  },
  /**
   * @todo Wire up joinsTestSuite() and transactionsTestSuite(). normalTestSuite()
   * and uuidTestSuite() need non-serial / UUID string ids, which the numeric-id
   * adapter can't model.
   */
  tests: [authFlowTestSuite(), numberIdTestSuite(), caseInsensitiveTestSuite()],
  async onFinish() {
    // Stop Strapi.
    await stopStrapi();
  },
});

// Restore the playground's content types, also when the suite fails early.
afterAll(async () => {
  try {
    await stopStrapi();
  } finally {
    await fs.rm(contentTypesDir, { recursive: true, force: true });
    await fs.cp(contentTypesBackupDir, contentTypesDir, { recursive: true });
    await fs.rm(contentTypesBackupDir, { recursive: true, force: true });
    await cleanupDir(path.join(playgroundDir, "dist"));
  }
});

execute();
