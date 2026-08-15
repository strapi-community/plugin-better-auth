import type { Modules, UID } from "@strapi/strapi";
import {
  createAdapterFactory,
  type DBAdapterDebugLogOption,
} from "better-auth/adapters";
import kebabCase from "lodash/kebabCase";
import { runAsInternalCall } from "./internal-context";
import {
  transformFilters,
  transformSort,
  transformOutput as transformStrapiOutput,
  updateStrapiSchema,
} from "./transformers";

/**
 * Re-exported here so consumers importing from the package root (the `.` export,
 * which resolves types straight to this file - see `types`/`exports["."]` in
 * package.json) can use `runAsInternalCall` to exempt their own document service
 * calls from `restrictDocumentService`, the same way this adapter does.
 *
 * @see ../middlewares/restrict-document-service.ts
 */
export { isInternalCall, runAsInternalCall } from "./internal-context";

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

  return createAdapterFactory({
    config: {
      adapterId: "strapi-adapter",
      adapterName: "Strapi Adapter",
      usePlural,
      debugLogs,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: true,
    },
    // @ts-expect-error
    // Caused by returning true to opt-out of Better Auth's file writing logic in createSchema method
    // https://github.com/better-auth/better-auth/issues/8590
    adapter: ({ getFieldName, getDefaultModelName, debugLog }) => {
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

      return {
        /**
         * Create a new record
         */
        create: async ({ data, model, select }) => {
          debugLog("create", { model, data, select });

          const uid = getModelUid(model);
          const fields = mapSelectFields(model, select);

          const result = await runAsInternalCall(() =>
            strapi.documents(uid).create({
              data,
              fields,
            }),
          );

          return transformStrapiOutput(result);
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

          if (!record) {
            throw new Error(`Record not found for model ${model}`);
          }

          const result = await runAsInternalCall(() =>
            strapi.documents(uid).update({
              documentId: record.documentId,
              // @ts-expect-error
              data: update,
            }),
          );

          if (!result) {
            throw new Error(`Failed to update record for model ${model}`);
          }

          const output = await transformStrapiOutput(result);
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

          // Update each record
          for (const record of records) {
            await runAsInternalCall(() =>
              strapi.documents(uid).update({
                documentId: record.documentId,
                data: update,
              }),
            );
          }

          return records.length;
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

          await runAsInternalCall(() =>
            strapi.documents(uid).delete({
              documentId: record.documentId,
            }),
          );
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

          // Delete each record
          for (const record of records) {
            await runAsInternalCall(() =>
              strapi.documents(uid).delete({
                documentId: record.documentId,
              }),
            );
          }

          return records.length;
        },

        /**
         * Find a single record
         */
        findOne: async ({ where, model, select }) => {
          debugLog("findOne", { model, where, select });

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

          return transformStrapiOutput(record);
        },

        /**
         * Find multiple records
         */
        findMany: async ({ where, model, limit, offset, sortBy, select }) => {
          debugLog("findMany", { model, where, limit, offset, sortBy });

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

          return Promise.all(
            records.map(async (record) => {
              return transformStrapiOutput(record);
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
};
