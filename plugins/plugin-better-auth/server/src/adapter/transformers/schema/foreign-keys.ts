import fs from "node:fs/promises";
import path from "node:path";
import type { Core } from "@strapi/strapi";
import type { BetterAuthDBSchema } from "better-auth/db";
import snakeCase from "lodash/snakeCase";
import { PLUGIN_ID } from "../../../utils";
import type { CTBContentType } from "./types";
import { generateNames } from "./utils";

/**
 * A foreign key as Strapi's database layer expects it in a content type schema.
 * Strapi passes a schema's `foreignKeys` through to the database model, the
 * same way it declares the foreign keys of its own component tables.
 */
export interface SchemaForeignKey {
  name: string;
  columns: string[];
  referencedColumns: string[];
  referencedTable: string;
  onDelete: string;
}

/**
 * The foreign keys of one content type, and the attributes they're on.
 */
export interface ContentTypeForeignKeys {
  attributes: string[];
  foreignKeys: SchemaForeignKey[];
}

/**
 * Resolves a `references.model` value (which may be the configured `modelName`)
 * back to the schema key used for the Strapi UID.
 */
const resolveModelKey = (tables: BetterAuthDBSchema, model: string) =>
  Object.keys(tables).find(
    (key) => key === model || tables[key].modelName === model,
  );

/**
 * Builds the foreign keys Better Auth's own migrator would create for every
 * `references` field (`ON DELETE <references.onDelete ?? "cascade">`), so the
 * database cascades deletes, e.g. an organization's members.
 *
 * Keyed by content type UID.
 */
export function getForeignKeys(
  strapi: Core.Strapi,
  tables: BetterAuthDBSchema,
): Map<string, ContentTypeForeignKeys> {
  const { identifiers } = strapi.db.metadata;
  const result = new Map<string, ContentTypeForeignKeys>();

  const getTableName = (modelKey: string) =>
    identifiers.getTableName(
      generateNames(modelKey, PLUGIN_ID, tables[modelKey].modelName)
        .collectionName,
    );

  for (const [modelKey, table] of Object.entries(tables)) {
    if (table.disableMigrations) continue;

    const tableName = getTableName(modelKey);
    const entry: ContentTypeForeignKeys = { attributes: [], foreignKeys: [] };

    for (const [fieldKey, field] of Object.entries(table.fields)) {
      const references = field.references;
      // Only references to `id` are stored as integers that can hold a foreign key.
      if (references?.field !== "id") continue;

      const referencedKey = resolveModelKey(tables, references.model);
      if (!referencedKey || tables[referencedKey].disableMigrations) continue;

      const attributeName = field.fieldName ?? fieldKey;
      const column = identifiers.getColumnName(snakeCase(attributeName));

      entry.attributes.push(attributeName);
      entry.foreignKeys.push({
        name: identifiers.getFkIndexName([tableName, column]),
        columns: [column],
        referencedColumns: ["id"],
        referencedTable: getTableName(referencedKey),
        onDelete: (references.onDelete ?? "cascade").toUpperCase(),
      });
    }

    result.set(generateNames(modelKey, PLUGIN_ID).uid, entry);
  }

  return result;
}

/**
 * Writes the foreign keys into the generated schema files.
 *
 * The content-type-builder only writes the schema keys it knows about, so this
 * runs after it and adds `foreignKeys` itself. It also marks the referencing
 * columns unsigned: Strapi's `id` column is unsigned on MySQL, and MySQL
 * refuses foreign keys between columns of a different signedness.
 */
export async function writeForeignKeys(
  strapi: Core.Strapi,
  contentTypes: CTBContentType[],
  foreignKeys: Map<string, ContentTypeForeignKeys>,
) {
  for (const contentType of contentTypes) {
    if (contentType.action === "delete") continue;

    const entry = foreignKeys.get(contentType.uid);
    if (!entry) continue;

    const filePath = path.join(
      strapi.dirs.app.extensions,
      PLUGIN_ID,
      "content-types",
      contentType.singularName,
      "schema.json",
    );
    const schema = JSON.parse(await fs.readFile(filePath, "utf8"));

    for (const attributeName of entry.attributes) {
      const attribute = schema.attributes?.[attributeName];
      if (attribute) {
        attribute.column = { ...attribute.column, unsigned: true };
      }
    }

    if (entry.foreignKeys.length > 0) {
      schema.foreignKeys = entry.foreignKeys;
    } else {
      delete schema.foreignKeys;
    }

    // Same formatting as the content-type-builder.
    await fs.writeFile(filePath, `${JSON.stringify(schema, null, 2)}\n`);
  }
}
