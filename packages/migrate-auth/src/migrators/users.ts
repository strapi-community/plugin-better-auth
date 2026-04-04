import type {
  DestinationAdapter,
  MigrationReport,
  SourceAdapter,
} from "../adapters/types";

export interface MigrateUsersOptions {
  /** Reads user records from the source auth provider */
  source: SourceAdapter;
  /** Writes user records to the destination auth provider */
  destination: DestinationAdapter;
  /**
   * When true, queries are executed but no records are written.
   * The report will show accurate `total` and `skipped` counts but `migrated` will be 0.
   * @default false
   */
  dryRun?: boolean;
  /**
   * When true, users whose email already exists in the destination are skipped.
   * @default true
   */
  skipExisting?: boolean;
  /**
   * Number of source users to process per batch.
   * @default 100
   */
  batchSize?: number;
}

/**
 * Migrates users from a source auth provider to a destination auth provider.
 *
 * The migration engine is decoupled from any specific provider — it only calls
 * the `SourceAdapter` and `DestinationAdapter` interfaces. To migrate from a
 * different source or to a different destination, swap the adapter implementations.
 *
 * @example
 * ```ts
 * const report = await migrateUsers({
 *   source: new UsersPermissionsSource(strapi),
 *   destination: new BetterAuthDestination(strapi),
 *   skipExisting: true,
 * });
 * console.log(report);
 * ```
 */
export async function migrateUsers(
  options: MigrateUsersOptions,
): Promise<MigrationReport> {
  const {
    source,
    destination,
    dryRun = false,
    skipExisting = true,
    batchSize = 100,
  } = options;

  const report: MigrationReport = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  report.total = await source.getUserCount();

  let offset = 0;

  while (offset < report.total) {
    const users = await source.getUsers({ limit: batchSize, offset });

    for (const user of users) {
      try {
        const exists = skipExisting && (await destination.userExists(user.email));

        if (exists) {
          report.skipped++;
          continue;
        }

        if (!dryRun) {
          const migratedUser = await destination.createUser(user);
          await destination.createAccount(user, migratedUser);
          report.migrated++;
        }
      } catch (err) {
        report.errors.push({
          email: user.email,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    offset += batchSize;
  }

  return report;
}
