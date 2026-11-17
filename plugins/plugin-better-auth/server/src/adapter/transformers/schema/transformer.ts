import type { Core, UID } from "@strapi/strapi";
import type { BetterAuthDBSchema } from "better-auth";
import isEqual from "lodash/isEqual";
import snakeCase from "lodash/snakeCase";
import { PLUGIN_ID } from "../../../utils";
import type {
  CTBAttribute,
  CTBAttributeProperties,
  CTBContentType,
  SchemaTransformResult,
  StrapiAttribute,
  TransformResult,
} from "./types";
import {
  contentTypeExists,
  createAttributeProperties,
  generateNames,
  getExistingAttributes,
  getExistingBAContentTypes,
  isManagedField,
  isVisible,
} from "./utils";

// Re-import INTERNAL_FIELDS as value
const SKIP_FIELDS = [
  "id",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "locale",
  "localizations",
];

/**
 * Compares two attributes to check if they're equivalent
 */
function attributesAreEqual(
  existing: StrapiAttribute,
  newAttr: CTBAttributeProperties,
): boolean {
  if (existing.type !== newAttr.type) return false;
  if ((existing.required ?? false) !== (newAttr.required ?? false))
    return false;
  if ((existing.unique ?? false) !== (newAttr.unique ?? false)) return false;
  if (!isEqual(existing.default, newAttr.default)) return false;
  if (existing.type === "enumeration" && !isEqual(existing.enum, newAttr.enum))
    return false;
  if (!isManagedField(existing)) return false;
  return true;
}

/**
 * Finds orphaned Better Auth fields that should be deleted
 */
function getOrphanedFields(
  strapi: Core.Strapi,
  uid: UID.ContentType,
  expectedFields: Set<string>,
): string[] {
  const existing = getExistingAttributes(strapi, uid);
  return Object.entries(existing)
    .filter(
      ([name, attr]) =>
        !SKIP_FIELDS.includes(name) &&
        isManagedField(attr) &&
        !expectedFields.has(name),
    )
    .map(([name]) => name);
}

/**
 * Builds attributes array for a content type update
 */
function buildAttributes(
  strapi: Core.Strapi,
  uid: UID.ContentType,
  table: BetterAuthDBSchema[string],
  changeDetails: string[],
  useDocumentId: boolean,
): CTBAttribute[] {
  const attributes: CTBAttribute[] = [];
  const existingAttributes = getExistingAttributes(strapi, uid);

  // Preserve user-added fields
  for (const [name, attr] of Object.entries(existingAttributes)) {
    if (SKIP_FIELDS.includes(name) || isManagedField(attr)) continue;
    attributes.push({
      action: "update",
      name,
      properties: attr as CTBAttributeProperties,
    });
  }

  // Process Better Auth fields
  for (const [name, field] of Object.entries(table.fields)) {
    if (SKIP_FIELDS.includes(name)) continue;

    const actualName = field.fieldName ?? name;
    const props = createAttributeProperties(name, field, useDocumentId);
    const existing = existingAttributes[actualName];

    if (existing) {
      if (!attributesAreEqual(existing, props)) {
        changeDetails.push(`Updating field: ${actualName} in ${uid}`);
      }
      attributes.push({
        action: "update",
        name: actualName,
        properties: props,
      });
    } else {
      changeDetails.push(`Creating field: ${actualName} in ${uid}`);
      attributes.push({
        action: "create",
        name: actualName,
        properties: props,
      });
    }
  }

  // Delete orphaned fields
  const expectedFields = new Set(
    Object.entries(table.fields)
      .filter(([n]) => !SKIP_FIELDS.includes(n))
      .map(([n, f]) => f.fieldName ?? n),
  );
  for (const name of getOrphanedFields(strapi, uid, expectedFields)) {
    changeDetails.push(`Deleting orphaned field: ${name} in ${uid}`);
    attributes.push({ action: "delete", name });
  }

  return attributes;
}

/**
 * Transforms a single table to CTB content type format
 */
export function transformTable(
  strapi: Core.Strapi,
  modelKey: string,
  table: BetterAuthDBSchema[string],
  useDocumentId = false,
): TransformResult {
  const pluginName = PLUGIN_ID;
  const names = generateNames(
    modelKey,
    pluginName,
    table.modelName || undefined,
  );
  const uid = names.uid as UID.ContentType;

  const exists = contentTypeExists(strapi, uid);
  const changeDetails: string[] = [];

  if (!exists) changeDetails.push(`Creating new content type: ${uid}`);

  const attributes = buildAttributes(
    strapi,
    uid,
    table,
    changeDetails,
    useDocumentId,
  );

  const visible = isVisible(modelKey);
  const defaultPluginOptions = {
    "content-manager": { visible },
    "content-type-builder": { visible },
  };
  const pluginOptions = exists
    ? ((strapi.contentTypes[uid]?.pluginOptions as Record<string, unknown>) ??
      defaultPluginOptions)
    : defaultPluginOptions;

  return {
    contentType: {
      action: exists ? "update" : "create",
      uid,
      modelName: names.singularName,
      kind: "collectionType",
      globalId: names.globalId,
      pluginOptions,
      collectionName: names.collectionName,
      modelType: "contentType",
      attributes,
      status: exists ? "CHANGED" : "NEW",
      draftAndPublish: false,
      plugin: pluginName,
      singularName: names.singularName,
      pluralName: names.pluralName,
      displayName: names.displayName,
    },
    changeDetails,
  };
}

/**
 * Creates a delete action for an orphaned content type
 */
function createDeleteContentType(
  strapi: Core.Strapi,
  uid: UID.ContentType,
  pluginName: string,
): CTBContentType {
  const ct = strapi.contentTypes[uid];
  const singularName = ct?.info?.singularName || uid.split(".").pop() || "";
  const pluralName = ct?.info?.pluralName || `${singularName}s`;

  return {
    action: "delete",
    uid,
    apiName: singularName,
    modelName: singularName,
    kind: "collectionType",
    globalId: singularName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(""),
    pluginOptions: {},
    collectionName:
      ct?.collectionName || `${snakeCase(pluginName)}_${snakeCase(pluralName)}`,
    modelType: "contentType",
    attributes: [],
    draftAndPublish: false,
    plugin: pluginName,
    singularName,
    pluralName,
    displayName: ct?.info?.displayName || singularName,
  };
}

/**
 * Transforms the entire Better Auth schema to CTB format
 */
export function transformSchema(
  strapi: Core.Strapi,
  tables: BetterAuthDBSchema,
  useDocumentId = false,
): SchemaTransformResult {
  const pluginName = PLUGIN_ID;
  const contentTypes: CTBContentType[] = [];
  const allChangeDetails: string[] = [];

  // Get expected vs existing UIDs
  const expectedUIDs = new Set(
    Object.entries(tables)
      .filter(([, t]) => !t.disableMigrations)
      .map(
        ([k]) =>
          `plugin::${pluginName}.${generateNames(k, pluginName).singularName}`,
      ),
  );
  const existingUIDs = getExistingBAContentTypes(strapi, pluginName);

  // Process all tables — content-types dir is always wiped before generation
  // so every table is always included to ensure a clean sync.
  for (const [key, table] of Object.entries(tables)) {
    if (table.disableMigrations) continue;

    const result = transformTable(strapi, key, table, useDocumentId);
    contentTypes.push(result.contentType);
    allChangeDetails.push(...result.changeDetails);
  }

  // Delete orphaned content types
  for (const uid of existingUIDs) {
    if (!expectedUIDs.has(uid)) {
      allChangeDetails.push(`Deleting orphaned content type: ${uid}`);
      contentTypes.push(createDeleteContentType(strapi, uid, pluginName));
    }
  }

  return {
    schema: { components: [], contentTypes },
    allChangeDetails,
  };
}
