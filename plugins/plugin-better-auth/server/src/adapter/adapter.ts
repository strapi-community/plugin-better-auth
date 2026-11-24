import type { Modules, UID } from "@strapi/strapi";
import {
  createAdapterFactory,
  type DBAdapterDebugLogOption,
} from "better-auth/adapters";
import type { DBTransactionAdapter, JoinConfig } from "better-auth/types";
import kebabCase from "lodash/kebabCase";
import {
  transformFilters,
  transformSort,
  transformOutput as transformStrapiOutput,
  updateStrapiSchema,
} from "./transformers";

/**
 * Configuration options for the Strapi Better Auth adapter
 */
interface StrapiAdapterConfig {
  /**
   * Helps you debug issues with the adapter
   */
  debugLogs?: DBAdapterDebugLogOption;
  /**
   * If the table names in the schema are plural
   */
  usePlural?: boolean;
}

/**
 * Strapi Better Auth Database Adapter
 *
 * This adapter allows Better Auth to use Strapi as its database backend.
 * It implements all the required methods to interact with Strapi's entity service.
 */
export const strapiAdapter = (config?: StrapiAdapterConfig) => {
  const { debugLogs = false, usePlural = false } = config || {};

  // The fully-built, transform-aware adapter, captured when the factory is
  // invoked below. `config.transaction` hands this instance to the transaction
  // callback: Strapi's document service enlists in the transaction opened by
  // `strapi.db.transaction` through async-local storage, so the same adapter
  // operates on the transaction without needing a separate handle.
  let txAdapter: ReturnType<ReturnType<typeof createAdapterFactory>>;

  const createStrapiAdapter = createAdapterFactory({
    config: {
      adapterId: "strapi-adapter",
      adapterName: "Strapi Adapter",
      usePlural,
      debugLogs,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: true,
      /**
       * Run several operations atomically inside one Strapi database
       * transaction. Better Auth invokes this with a callback that receives a
       * transaction-scoped adapter; the callback's result is committed, and any
       * error it throws rolls the whole transaction back.
       */
      transaction: <R>(
        callback: (trx: DBTransactionAdapter) => Promise<R>,
      ): Promise<R> =>
        strapi.db.transaction(() => callback(txAdapter)) as Promise<R>,
    },
    // @ts-expect-error
    // Caused by returning true to opt-out of Better Auth's file writing logic in createSchema method
    // https://github.com/better-auth/better-auth/issues/8590
    adapter: ({
      getFieldName,
      getDefaultModelName,
      debugLog,
      options,
      schema,
    }) => {
      // The adapter stores records under Strapi's numeric `id` and relies on
      // integer foreign keys with `ON DELETE CASCADE`, which Better Auth needs
      // for its cascade deletes (e.g. removing a user clears their sessions and
      // accounts). Any other id strategy silently breaks relations and cascades,
      // so require `generateId: "serial"` and fail fast with a clear message.
      if (options?.advanced?.database?.generateId !== "serial") {
        throw new Error(
          'The Strapi Better Auth adapter requires `advanced.database.generateId: "serial"`. ' +
            "It stores records using Strapi's numeric id and relies on integer foreign keys " +
            "with ON DELETE CASCADE; UUID, the default random string, and custom id generators " +
            "are not supported.",
        );
      }

      /**
       * Get the Strapi UID for a model.
       * The factory passes `model` as the configured name (e.g. "user_table" when
       * modelName is overridden). We use getDefaultModelName to resolve it back to
       * the original schema key so the Strapi UID is always stable.
       */
      const getModelUid = (model: string): UID.ContentType => {
        const originalKey = getDefaultModelName(model);
        return `plugin::better-auth.${kebabCase(originalKey)}` as UID.ContentType;
      };

      /**
       * Turn a Strapi record into the record Better Auth expects: only the
       * model's Better Auth fields (plus `id` and any joined models), with
       * date strings coerced to dates.
       *
       * Strapi adds its own attributes to every document (`documentId`,
       * `publishedAt`, ...). The factory ignores unknown fields when it
       * transforms our output, but some of its internals read our raw output.
       * Better Auth 1.7's atomic fallbacks, for instance, turn every field of
       * a row into a `where` guard, which our filter transformer rejects for
       * fields Better Auth doesn't know.
       */
      const toBetterAuthRecord = <T>(
        model: string,
        record: T,
        join?: JoinConfig,
      ): T => {
        if (!record || typeof record !== "object") {
          return transformStrapiOutput(record);
        }

        const modelKey = getDefaultModelName(model);
        const allowed = new Set([
          "id",
          ...Object.keys(schema[modelKey]?.fields ?? {}).map((field) =>
            getFieldName({ model: modelKey, field }),
          ),
          ...Object.keys(join ?? {}),
        ]);

        const picked = Object.fromEntries(
          Object.entries(record).filter(([key]) => allowed.has(key)),
        );

        return transformStrapiOutput(picked as T);
      };

      /**
       * Map select fields to support field renaming
       */
      const mapSelectFields = (model: string, select?: string[]) => {
        if (!select) {
          return undefined;
        }

        return select.map((field) =>
          getFieldName({ model, field }),
        ) as Modules.Documents.Params.Fields.Any<UID.ContentType>;
      };

      /**
       * Natively resolve Better Auth joins.
       *
       * When `experimental.joins` is enabled, Better Auth delegates joins to
       * the adapter instead of emulating them with extra round-trips. It passes
       * a `JoinConfig` keyed by the joined model's name, each entry describing
       * which base column (`on.from`) matches which joined column (`on.to`) and
       * whether the relation is one-to-one or one-to-many.
       *
       * Better Auth's output transformer reads the joined rows straight off the
       * base record under that same model key, so we attach the resolved rows
       * there as raw Strapi records (date coercion is applied together with the
       * base record by the caller's `transformOutput`).
       */
      const applyJoins = async (
        records: Record<string, unknown>[],
        join: JoinConfig,
      ): Promise<void> => {
        const joinEntries = Object.entries(join);

        await Promise.all(
          records.map((record) =>
            Promise.all(
              joinEntries.map(async ([joinModel, joinConfig]) => {
                const isOneToOne = joinConfig.relation === "one-to-one";
                const fromValue = record[joinConfig.on.from];

                // A missing foreign key resolves to no related rows.
                if (fromValue === null || fromValue === undefined) {
                  record[joinModel] = isOneToOne ? null : [];
                  return;
                }

                const joinUid = getModelUid(joinModel);
                const filters = {
                  [joinConfig.on.to]: { $eq: fromValue },
                } as Modules.Documents.Params.Filters.Any<UID.ContentType>;

                if (isOneToOne) {
                  const joined = await strapi
                    .documents(joinUid)
                    .findFirst({ filters, limit: 1 });
                  record[joinModel] = joined ?? null;
                } else {
                  const joined = await strapi.documents(joinUid).findMany({
                    filters,
                    ...(joinConfig.limit !== undefined
                      ? { limit: joinConfig.limit }
                      : {}),
                  });
                  record[joinModel] = joined ?? [];
                }
              }),
            ),
          ),
        );
      };

      /**
       * Lock the first row matching `filters` until the current transaction
       * ends, and return its `documentId`, or `null` when no row matches.
       *
       * This is what makes `consumeOne` and `incrementOne` race-safe: a
       * concurrent caller blocks on the lock and, once the first caller
       * commits, re-evaluates `filters` against the committed row (Postgres and
       * MySQL locking reads always see the latest committed version). SQLite
       * has no row locks, but Strapi's SQLite pool holds a single connection,
       * so its transactions already run one at a time.
       */
      const lockFirstMatch = async (
        uid: UID.ContentType,
        filters: Record<string, unknown>,
      ): Promise<string | null> => {
        const query = strapi.db
          .queryBuilder(uid)
          .select(["documentId"])
          .where(filters)
          .first();

        if (strapi.db.dialect.client !== "sqlite") {
          query.forUpdate();
        }

        const row = await query.execute<{ documentId: string } | undefined>();
        return row?.documentId ?? null;
      };

      return {
        /**
         * Create a new record
         */
        create: async ({ data, model, select }) => {
          debugLog("create", { model, data, select });

          const uid = getModelUid(model);
          const fields = mapSelectFields(model, select);

          const result = await strapi.documents(uid).create({
            data,
            fields,
          });

          return toBetterAuthRecord(model, result);
        },

        /**
         * Update a single record
         */
        update: async ({ where, update, model }) => {
          debugLog("update", { model, where, update });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          // Find the record first
          const record = await strapi.documents(uid).findFirst({
            filters,
            limit: 1,
          });

          // Better Auth expects `null` when `where` matches no record (or the
          // record is deleted before it can be updated), not an error.
          if (!record) {
            return null;
          }

          const result = await strapi.documents(uid).update({
            documentId: record.documentId,
            // @ts-expect-error
            data: update,
          });

          if (!result) {
            return null;
          }

          const output = toBetterAuthRecord(model, result);
          return output;
        },

        /**
         * Update multiple records
         */
        updateMany: async ({ where, update, model }) => {
          debugLog("updateMany", { model, where, update });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          // Find all matching records
          const records = await strapi.documents(uid).findMany({
            filters,
          });

          if (!records || records.length === 0) {
            return 0;
          }

          // Update each record. Count only the records that were actually
          // updated: one deleted after the lookup above makes `update` return
          // null. Better Auth relies on an accurate affected-row count (e.g.
          // its atomic fallbacks), so don't report the lookup's length.
          let updated = 0;
          for (const record of records) {
            const result = await strapi.documents(uid).update({
              documentId: record.documentId,
              data: update,
            });
            if (result) updated++;
          }

          return updated;
        },

        /**
         * Delete a single record
         */
        delete: async ({ where, model }) => {
          debugLog("delete", { model, where });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          // Find the record first
          const record = await strapi.documents(uid).findFirst({
            filters,
            limit: 1,
          });

          if (!record) {
            return;
          }

          await strapi.documents(uid).delete({
            documentId: record.documentId,
          });
        },

        /**
         * Delete multiple records
         */
        deleteMany: async ({ where, model }) => {
          debugLog("deleteMany", { model, where });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          // Find all matching records
          const records = await strapi.documents(uid).findMany({
            filters,
          });

          if (!records || records.length === 0) {
            return 0;
          }

          // Delete each record. Count only the rows that were actually
          // deleted: a concurrent caller may have deleted a record after the
          // lookup above, in which case `delete` removes no entries. Better
          // Auth relies on an accurate affected-row count (e.g. its atomic
          // fallbacks), so don't report the lookup's length.
          let deleted = 0;
          for (const record of records) {
            const { entries } = await strapi.documents(uid).delete({
              documentId: record.documentId,
            });
            deleted += entries.length;
          }

          return deleted;
        },

        /**
         * Atomically delete a single record and return it.
         *
         * Better Auth uses this for single-use credentials (verification
         * tokens, one-time tokens, OTPs). Concurrent callers racing on the same
         * row are serialized by `lockFirstMatch`, so exactly one of them gets
         * the row and the others get `null`. Only the first match is deleted,
         * even when `where` matches several rows.
         */
        consumeOne: async ({ where, model }) => {
          debugLog("consumeOne", { model, where });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          return strapi.db.transaction(async () => {
            const documentId = await lockFirstMatch(uid, filters);
            if (!documentId) {
              return null;
            }

            const record = await strapi.documents(uid).findOne({ documentId });
            if (!record) {
              return null;
            }

            await strapi.documents(uid).delete({ documentId });

            return toBetterAuthRecord(model, record);
          });
        },

        /**
         * Atomically apply numeric deltas (and optional absolute `set` values)
         * to a single record, and return the updated record.
         *
         * `where` is both the selector and the guard: when it matches no row,
         * nothing changes and `null` is returned. Better Auth uses this for 2FA
         * attempt counters, the database rate limiter and organization counts.
         * The new values are computed while holding the row lock from
         * `lockFirstMatch`, so concurrent increments are never lost and a guard
         * such as `counter > 0` can't be passed by more callers than it allows.
         */
        incrementOne: async ({ where, model, increment, set }) => {
          debugLog("incrementOne", { model, where, increment, set });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);

          return strapi.db.transaction(async () => {
            const documentId = await lockFirstMatch(uid, filters);
            if (!documentId) {
              return null;
            }

            const record = await strapi.documents(uid).findOne({ documentId });
            if (!record) {
              return null;
            }

            const data: Record<string, unknown> = { ...set };
            for (const [field, delta] of Object.entries(increment)) {
              const current = (record as Record<string, unknown>)[field];
              data[field] = Number(current ?? 0) + delta;
            }

            const result = await strapi.documents(uid).update({
              documentId,
              data,
            });

            return result ? toBetterAuthRecord(model, result) : null;
          });
        },

        /**
         * Find a single record
         */
        findOne: async ({ where, model, select, join }) => {
          debugLog("findOne", { model, where, select, join });

          const uid = getModelUid(model);
          const filters = transformFilters(where, model, getFieldName);
          const fields = mapSelectFields(model, select);

          const record = await strapi.documents(uid).findFirst({
            filters,
            fields,
            limit: 1,
          });

          if (!record) {
            return null;
          }

          if (join && Object.keys(join).length > 0) {
            await applyJoins(
              [record] as Record<string, unknown>[],
              join as JoinConfig,
            );
          }

          return toBetterAuthRecord(model, record, join as JoinConfig);
        },

        /**
         * Find multiple records
         */
        findMany: async ({
          where,
          model,
          limit,
          offset,
          sortBy,
          select,
          join,
        }) => {
          debugLog("findMany", { model, where, limit, offset, sortBy, join });

          const uid = getModelUid(model);
          const filters = where
            ? transformFilters(where, model, getFieldName)
            : {};
          const fields = mapSelectFields(model, select);

          const queryOptions: { [key: string]: unknown } = {
            filters,
            fields,
          };

          if (limit !== undefined) {
            queryOptions.limit = limit;
          }

          if (offset !== undefined) {
            queryOptions.start = offset;
          }

          if (sortBy) {
            // Convert Better Auth sortBy to Strapi sort format
            queryOptions.sort = transformSort(sortBy, model, getFieldName);
          }

          const records = await strapi.documents(uid).findMany(queryOptions);

          if (!records || records.length === 0) {
            return [];
          }

          if (join && Object.keys(join).length > 0) {
            await applyJoins(
              records as Record<string, unknown>[],
              join as JoinConfig,
            );
          }

          return Promise.all(
            records.map(async (record) => {
              return toBetterAuthRecord(model, record, join as JoinConfig);
            }),
          );
        },

        /**
         * Count records
         */
        count: async ({ where, model }) => {
          debugLog("count", { model, where });

          const uid = getModelUid(model);
          const filters = where
            ? transformFilters(where, model, getFieldName)
            : undefined;

          const records = await strapi.documents(uid).findMany({
            filters,
          });

          return records ? records.length : 0;
        },

        /**
         * Create schema files for Strapi content-types
         *
         * This method uses Strapi's content-type-builder updateSchema service
         * to create/update content types based on Better Auth schema.
         * This is the same API that Strapi's admin panel uses.
         */
        createSchema: async ({ tables }) => {
          debugLog("createSchema", { tables });

          const { cleanupStrapiApp, cleanupDistDirectory, getStrapiApp } =
            await import("./cli");

          // Wipe the compiled dist so the updated config/plugins.ts (which
          // carries the table_prefix) is recompiled from source.
          await cleanupDistDirectory({ distDir: `${process.cwd()}/dist` });

          // Bootstrap Strapi to access the content-type-builder service
          const { app: strapi, distDir } = await getStrapiApp();

          // Use Strapi's content-type-builder service to create/update schemas
          await updateStrapiSchema(strapi, tables);

          // Clean up Strapi's dist directory and destroy the app instance
          cleanupStrapiApp(strapi, distDir);

          /**
           * We return true to opt-out of the file writing logic from Better Auth.
           * This is more like a workaround than a proper solution.
           *
           * @see https://github.com/better-auth/better-auth/issues/8590
           */
          return true;
        },

        /**
         * Return adapter options
         */
        options: config,
      };
    },
  });

  return (options: Parameters<typeof createStrapiAdapter>[0]) => {
    txAdapter = createStrapiAdapter(options);

    // Keep the built-in `transaction` method stable. Better Auth's adapter test
    // harness assigns `adapter.transaction = undefined` between operations (to
    // stop its own wrapper from recursing) and then reads it back when opening a
    // transaction, without rebuilding the adapter first — which would otherwise
    // drop our transaction support and fall back to a non-atomic path. Guarding
    // the setter so it ignores nullish writes keeps the capability intact while
    // still allowing a genuine replacement.
    let transaction = txAdapter.transaction;
    Object.defineProperty(txAdapter, "transaction", {
      configurable: true,
      enumerable: true,
      get: () => transaction,
      set: (value) => {
        if (value) transaction = value;
      },
    });

    return txAdapter;
  };
};
