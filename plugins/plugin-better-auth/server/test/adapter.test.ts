import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  authFlowTestSuite,
  caseInsensitiveTestSuite,
  createTestSuite,
  joinsTestSuite,
  normalTestSuite,
  numberIdTestSuite,
  testAdapter,
  transactionsTestSuite,
  uuidTestSuite,
} from "@better-auth/test-utils/adapter";
import {
  cleanupDir,
  playgroundDir,
  setupStrapi,
  stopStrapi,
} from "@strapi-community/dev-utils";
import { getAuthTables } from "better-auth/db";
import { afterAll, expect } from "vitest";
import { strapiAdapter } from "../src/adapter";
import { updateStrapiSchema } from "../src/adapter/transformers";

/**
 * Verifies Better Auth's cascade deletes: removing a user must also remove the
 * rows that reference it (sessions, accounts). This is enforced by the database
 * foreign keys the adapter declares (`ON DELETE CASCADE`), so it runs in both id
 * modes — serial (integer FK -> `id`) and documentId (string FK -> `document_id`).
 */
const cascadeTestSuite = createTestSuite(
  "cascade",
  {},
  ({ adapter, insertRandom }) => ({
    "delete - deleting a user cascades its sessions": async () => {
      const [user, session] = await insertRandom("session");
      expect(
        await adapter.findOne({
          model: "session",
          where: [{ field: "id", value: session.id }],
        }),
      ).not.toBeNull();

      await adapter.delete({
        model: "user",
        where: [{ field: "id", value: user.id }],
      });

      expect(
        await adapter.findOne({
          model: "session",
          where: [{ field: "id", value: session.id }],
        }),
      ).toBeNull();
    },
    "delete - deleting a user cascades its accounts": async () => {
      const [user, account] = await insertRandom("account");
      expect(
        await adapter.findOne({
          model: "account",
          where: [{ field: "id", value: account.id }],
        }),
      ).not.toBeNull();

      await adapter.delete({
        model: "user",
        where: [{ field: "id", value: user.id }],
      });

      expect(
        await adapter.findOne({
          model: "account",
          where: [{ field: "id", value: account.id }],
        }),
      ).toBeNull();
    },
  }),
);

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

// MySQL's default collation is case-insensitive and Strapi's query API exposes
// no case-sensitive (binary) equality operator, so a `mode: "sensitive"` string
// comparison can't be made case-sensitive there. The case-insensitive operators
// themselves use `LOWER()` and work on every database, so only this one
// sensitivity assertion is skipped, and only on MySQL (it still runs on SQLite
// and Postgres, whose `=` is case-sensitive).
const caseInsensitiveOptions =
  (process.env.DATABASE_CLIENT ?? "sqlite") === "mysql"
    ? {
        disableTests: {
          "findOne - eq with mode sensitive (default) should not match different case": true,
        },
      }
    : undefined;

/**
 * Boots Strapi, regenerates the Better Auth content types from `opts`, drops the
 * old tables and restarts so the new schema is live. The id strategy decides
 * whether foreign keys are integer `id` columns (serial) or string `documentId`
 * columns, so it is threaded into the schema generation.
 */
async function runMigrations(opts: Parameters<typeof getAuthTables>[0]) {
  const authTables = getAuthTables(opts);
  const useDocumentId = opts.advanced?.database?.generateId !== "serial";

  // Remove stale compiled extension artifacts so Strapi loads fresh schema JSON.
  await cleanupDir(path.join(playgroundDir, "dist"));

  // Start up Strapi and run the schema updates.
  await setupStrapi();

  // Update Strapi schemas based on Better Auth configuration.
  await updateStrapiSchema(strapi, authTables, { useDocumentId });

  await resetBetterAuthTables();

  // Restart Strapi in order to load the new schemas before running tests.
  await stopStrapi();
  await setupStrapi();
}

/**
 * The adapter maps Better Auth's `id` onto Strapi's numeric `id` for serial ids
 * and onto Strapi's string `documentId` for everything else, so the suites are
 * split into two runs by id strategy:
 *
 * Serial (numeric id) — `generateId` forced to "serial":
 * - `authFlowTestSuite`         end-to-end sign up / sign in / session flow
 * - `numberIdTestSuite`         full CRUD + joins + filters on numeric ids
 * - `joinsTestSuite`            the same CRUD suite with `experimental.joins`
 *                               enabled, so Better Auth delegates joins to the
 *                               adapter instead of emulating them
 * - `caseInsensitiveTestSuite`  `mode: "insensitive"` string comparisons
 * - `transactionsTestSuite`     rollback of a failing `strapi.db.transaction`
 */
const serial = await testAdapter({
  adapter: (_options) => strapiAdapter() as never,
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
  runMigrations,
  tests: [
    authFlowTestSuite(),
    numberIdTestSuite(),
    joinsTestSuite(),
    caseInsensitiveTestSuite(caseInsensitiveOptions),
    transactionsTestSuite(),
    cascadeTestSuite(),
  ],
  async onFinish() {
    await stopStrapi();
  },
});

/**
 * String id mapped onto Strapi's `document_id`. No id override is applied, so the
 * suites keep Better Auth's native id strategy — the default is the native random
 * string, which is exactly how the adapter runs out of the box:
 * - `normalTestSuite`  full CRUD / filters / joins suite on Better Auth's native
 *                      (random string) ids
 * - `uuidTestSuite`    the same suite with `generateId: "uuid"`
 * - `cascadeTestSuite` cascade deletes through the string `document_id` FKs
 */
const documentId = await testAdapter({
  adapter: (_options) => strapiAdapter() as never,
  runMigrations,
  tests: [normalTestSuite(), uuidTestSuite(), cascadeTestSuite()],
  async onFinish() {
    await stopStrapi();
  },
});

// Restore the playground's content types, also when a suite fails early.
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

serial.execute();
documentId.execute();
