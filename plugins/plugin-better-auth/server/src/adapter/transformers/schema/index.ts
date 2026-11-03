import fs from "node:fs/promises";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import type { BetterAuthDBSchema } from "better-auth/db";
import { PLUGIN_ID } from "../../../utils";
import { transformSchema } from "./transformer";
import type { UpdateSchemaResult } from "./types";

export { transformSchema, transformTable } from "./transformer";
export * from "./types";
export * from "./utils";

/**
 * Updates Strapi schema based on Better Auth configuration.
 *
 * - Creates new content types for new tables
 * - Updates existing content types when fields change
 * - Deletes orphaned content types when plugins are disabled
 * - Deletes orphaned fields when removed from schema
 * - Preserves user-added custom fields
 */
export async function updateStrapiSchema(
  strapi: Core.Strapi,
  tables: BetterAuthDBSchema,
): Promise<UpdateSchemaResult> {
  const { schema, allChangeDetails } = transformSchema(strapi, tables);

  // Since Strapi 5.60 the CTB only deletes `api::` content types, so deletions
  // are handled below instead of being sent to the CTB.
  const deletedContentTypes = schema.contentTypes.filter(
    (contentType) => contentType.action === "delete",
  );
  schema.contentTypes = schema.contentTypes.filter(
    (contentType) => contentType.action !== "delete",
  );

  // The CTB service clones the in-memory __schema__ when writing content types
  // back to disk, so any pre-flight mutations here are reflected in the output.
  for (const contentType of schema.contentTypes) {
    const uid = contentType.uid;

    const rawSchema = (
      strapi.contentTypes[uid] as {
        __schema__?: {
          collectionName?: string;
          attributes?: Record<string, unknown>;
        };
      }
    )?.__schema__;

    if (rawSchema) {
      // Patch collectionName so a table_prefix change is written to disk.
      // CTB does not update collectionName itself — it only handles attributes.
      rawSchema.collectionName = contentType.collectionName;

      // Remove orphaned managed fields so CTB does not write them back.
      const orphanedFields = contentType.attributes
        .filter((attr) => attr.action === "delete")
        .map((attr) => attr.name);
      for (const field of orphanedFields) {
        delete rawSchema.attributes?.[field];
      }
    }
  }

  const schemaService = strapi.plugin("content-type-builder").service("schema");
  await schemaService.updateSchema(schema);

  // Better Auth content types only exist as schema files in the app's
  // extensions folder, so removing that folder deletes the content type.
  // Strapi drops its table on the next boot.
  for (const contentType of deletedContentTypes) {
    await fs.rm(
      path.join(
        strapi.dirs.app.extensions,
        PLUGIN_ID,
        "content-types",
        contentType.singularName,
      ),
      { recursive: true, force: true },
    );
  }

  return { changeDetails: allChangeDetails };
}
