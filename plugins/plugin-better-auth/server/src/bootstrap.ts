import {
  hasCompletedMigration,
  migrateFromUsersPermissions,
} from "./migrations/users-permissions/migrate";
import { isMigrationEnabled } from "./utils";

export default async () => {
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
