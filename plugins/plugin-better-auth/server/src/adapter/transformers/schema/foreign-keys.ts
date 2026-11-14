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
 * An index as Strapi's database layer expects it in a content type schema.
 * A `unique` index is created with knex `.unique()`, i.e. a real UNIQUE
 * constraint — which every database accepts as a foreign-key target.
 */
export interface SchemaIndex {
  name: string;
  columns: string[];
  type?: "unique";
}

/**
 * The foreign keys of one content type, and the attributes they're on.
 */
export interface ContentTypeForeignKeys {
  attributes: string[];
  foreignKeys: SchemaForeignKey[];
}

/**
 * The column every Strapi row carries for its document identity. In documentId
 * mode it is the Better Auth id, and it is the target of the string foreign
 * keys; a UNIQUE constraint on it is also the single-row lock (see below).
 */
const DOCUMENT_ID_COLUMN = "document_id";

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
  useDocumentId = false,
): Map<string, ContentTypeForeignKeys> {
  const { identifiers } = strapi.db.metadata;
  const result = new Map<string, ContentTypeForeignKeys>();

  // Serial ids reference the numeric `id`; non-serial ids are stored as the
  // referenced row's `document_id`, so the foreign keys reference that column.
  const referencedColumn = useDocumentId ? DOCUMENT_ID_COLUMN : "id";

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
      // Better Auth only ever references the primary identity field (`id`).
      if (references?.field !== "id") continue;

      const referencedKey = resolveModelKey(tables, references.model);
      if (!referencedKey || tables[referencedKey].disableMigrations) continue;

      const attributeName = field.fieldName ?? fieldKey;
      const column = identifiers.getColumnName(snakeCase(attributeName));

      entry.attributes.push(attributeName);
      entry.foreignKeys.push({
        name: identifiers.getFkIndexName([tableName, column]),
        columns: [column],
        referencedColumns: [referencedColumn],
        referencedTable: getTableName(referencedKey),
        onDelete: (references.onDelete ?? "cascade").toUpperCase(),
      });
    }

    result.set(generateNames(modelKey, PLUGIN_ID).uid, entry);
  }

  return result;
}

/**
 * Writes foreign keys and the single-row lock into the generated schema files.
 *
 * The content-type-builder only writes the schema keys it knows about (and won't
 * change the type of an already-managed attribute), so this runs after it and
 * patches the schema files directly.
 *
 * For every Better Auth content type it adds a UNIQUE index on `document_id`.
 * That is the single-row lock: a Strapi document is one row only while no
 * feature (Draft & Publish, i18n, or anything added in the future) stores a
 * second row under the same `document_id` — the unique constraint makes any such
 * attempt fail at the database. It is also what lets a non-serial foreign key
 * reference `document_id` (a foreign key needs a unique target).
 *
 * Then, per reference:
 * - documentId mode: the foreign key holds the referenced row's `document_id`
 *   (a string), so the attribute is rewritten to `string` and the foreign key
 *   references `document_id`.
 * - serial mode: the foreign key holds the numeric `id`, so the column is marked
 *   unsigned (Strapi's `id` is unsigned on MySQL, which refuses foreign keys
 *   between columns of different signedness) and references `id`.
 *
 * Both get `ON DELETE CASCADE` so Better Auth's cascade deletes work.
 */
export async function writeForeignKeys(
  strapi: Core.Strapi,
  contentTypes: CTBContentType[],
  foreignKeys: Map<string, ContentTypeForeignKeys>,
  useDocumentId = false,
) {
  const { identifiers } = strapi.db.metadata;

  for (const contentType of contentTypes) {
    if (contentType.action === "delete") continue;

    const filePath = path.join(
      strapi.dirs.app.extensions,
      PLUGIN_ID,
      "content-types",
      contentType.singularName,
      "schema.json",
    );
    const schema = JSON.parse(await fs.readFile(filePath, "utf8"));

    // Single-row lock: a UNIQUE constraint on document_id for every content type.
    const tableName = identifiers.getTableName(contentType.collectionName);
    const uniqueIndex: SchemaIndex = {
      name: identifiers.getUniqueIndexName([tableName, DOCUMENT_ID_COLUMN]),
      columns: [DOCUMENT_ID_COLUMN],
      type: "unique",
    };
    const otherIndexes = (schema.indexes ?? []).filter(
      (index: SchemaIndex) => index.name !== uniqueIndex.name,
    );
    schema.indexes = [...otherIndexes, uniqueIndex];

    // Foreign keys for this content type's references.
    const entry = foreignKeys.get(contentType.uid);
    if (entry) {
      for (const attributeName of entry.attributes) {
        const attribute = schema.attributes?.[attributeName];
        if (!attribute) continue;
        // Force the column type (the content-type-builder won't change the type
        // of an already-managed attribute, so switching id strategies — e.g.
        // regenerating a documentId schema as serial — relies on this patch).
        if (useDocumentId) {
          attribute.type = "string";
          delete attribute.column;
        } else {
          attribute.type = "integer";
          attribute.column = { ...attribute.column, unsigned: true };
        }
      }

      if (entry.foreignKeys.length > 0) {
        schema.foreignKeys = entry.foreignKeys;
      } else {
        delete schema.foreignKeys;
      }
    }

    // Same formatting as the content-type-builder.
    await fs.writeFile(filePath, `${JSON.stringify(schema, null, 2)}\n`);
  }
}
