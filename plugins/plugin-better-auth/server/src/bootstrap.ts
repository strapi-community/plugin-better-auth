import type { Core } from "@strapi/strapi";
import {
  hasCompletedMigration,
  migrateFromUsersPermissions,
} from "./migrations/users-permissions/migrate";
import { isMigrationEnabled, PLUGIN_ID } from "./utils";

/**
 * Better Auth content types must be exactly one database row per document. The
 * adapter maps a record onto a Strapi document, and Better Auth relies on
 * database foreign keys (with `ON DELETE CASCADE`) that reference a unique
 * `document_id`. Any feature that stores more than one row under the same
 * `document_id` — Draft & Publish, i18n localization, or anything equivalent
 * added in the future — breaks that model and its cascade deletes.
 *
 * The unique index the adapter puts on `document_id` enforces this at the
 * database for every such feature (a second row for a document is rejected).
 * This check additionally fails fast at boot, with a clear message, for the
 * features that exist today.
 */
const assertSingleRowContentTypes = (strapi: Core.Strapi) => {
  const prefix = `plugin::${PLUGIN_ID}.`;
  const offenders = Object.values(strapi.contentTypes)
    .filter((ct) => ct.uid.startsWith(prefix))
    .filter((ct) => {
      const options = ct.options as { draftAndPublish?: boolean } | undefined;
      const i18n = (
        ct.pluginOptions as { i18n?: { localized?: boolean } } | undefined
      )?.i18n;
      return options?.draftAndPublish === true || i18n?.localized === true;
    })
    .map((ct) => ct.uid);

  if (offenders.length > 0) {
    throw new Error(
      `[@strapi-community/plugin-better-auth] Draft & Publish and i18n localization ` +
        `store multiple rows per document, which breaks Better Auth and its cascade ` +
        `deletes. Disable them on these content types: ${offenders.join(", ")}.`,
    );
  }
};

export default async () => {
  // Enforce the single-row-per-document invariant for Better Auth content types.
  assertSingleRowContentTypes(strapi);

  /**
   * Run the one-time migration from users-permissions. It only runs in migration
   * mode (see `migration.enabled`), while the users-permissions plugin is still
   * installed, and only once (tracked in the plugin store). It runs here at
   * bootstrap rather than as a DB migration because it reads and writes through
   * the Document Service, which both plugins have made available by this point.
   */
  if (!isMigrationEnabled() || !strapi.plugin("users-permissions")) {
    return;
  }

  if (await hasCompletedMigration(strapi)) {
    strapi.log.info(
      "[@strapi-community/plugin-better-auth] users-permissions migration already completed; skipping.",
    );
    return;
  }

  const dryRun = Boolean(
    strapi.config.get("plugin::better-auth.migration.dryRun", false),
  );

  try {
    await migrateFromUsersPermissions(strapi, { dryRun });
  } catch (error) {
    // Don't brick the boot on a failed migration — it is idempotent and can be
    // retried once the underlying problem is fixed.
    strapi.log.error(
      `[@strapi-community/plugin-better-auth] users-permissions migration failed: ${
        (error as Error).message
      }`,
    );
  }
};
