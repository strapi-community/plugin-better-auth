import type { Core, UID } from "@strapi/strapi";
import type { DBFieldAttribute } from "better-auth";
import camelCase from "lodash/camelCase";
import kebabCase from "lodash/kebabCase";
import snakeCase from "lodash/snakeCase";
import upperFirst from "lodash/upperFirst";
import type { CTBAttributeProperties, StrapiAttribute } from "./types";

/**
 * Maps Better Auth field types to Strapi attribute types
 */
export function mapFieldType(field: DBFieldAttribute): string {
  const type = field.type;

  if (Array.isArray(type)) return "enumeration";

  switch (type) {
    case "string":
      return "text";
    case "number":
      return field.bigint ? "biginteger" : "integer";
    case "boolean":
      return "boolean";
    case "date":
      return "datetime";
    case "json":
    case "string[]":
    case "number[]":
      return "json";
    default:
      return "text";
  }
}

/**
 * Creates attribute properties from a Better Auth field
 */
export function createAttributeProperties(
  fieldName: string,
  field: DBFieldAttribute,
): CTBAttributeProperties {
  const properties: CTBAttributeProperties = {
    type: mapFieldType(field),
    configurable: false,
    pluginOptions: { "better-auth": { managed: true } },
  };

  if (field.required) properties.required = true;
  if (field.unique) properties.unique = true;

  if (
    field.defaultValue !== undefined &&
    typeof field.defaultValue !== "function"
  ) {
    properties.default = field.defaultValue;
  }

  if (Array.isArray(field.type)) {
    properties.enum = field.type;
  }

  // Foreign keys should be integers as we're using numeric IDs
  if (field.references?.field === "id") {
    properties.type = "integer";
  }

  // Special field type overrides
  if (fieldName === "email") properties.type = "email";
  // "text" (long text) fields can't be used as a Content Manager entry
  // title (mainField), so identifying fields need to stay "string" (short text).
  if (fieldName === "name") properties.type = "string";

  return properties;
}

/**
 * Checks if a field is managed by Better Auth
 */
export function isManagedField(attr: StrapiAttribute): boolean {
  return attr.pluginOptions?.["better-auth"]?.managed === true;
}

/**
 * Gets existing attributes for a content type
 */
export function getExistingAttributes(
  strapi: Core.Strapi,
  uid: UID.ContentType,
): Record<string, StrapiAttribute> {
  const contentType = strapi.contentTypes[uid];
  return contentType
    ? (contentType.attributes as Record<string, StrapiAttribute>)
    : {};
}

/**
 * Checks if a content type exists
 */
export function contentTypeExists(
  strapi: Core.Strapi,
  uid: UID.ContentType,
): boolean {
  return uid in strapi.contentTypes;
}

/**
 * Gets all existing Better Auth content types
 */
export function getExistingBAContentTypes(
  strapi: Core.Strapi,
  pluginName: string,
): UID.ContentType[] {
  const prefix = `plugin::${pluginName}.`;
  return Object.keys(strapi.contentTypes).filter((uid) =>
    uid.startsWith(prefix),
  ) as UID.ContentType[];
}

/**
 * Generates naming conventions for a model.
 *
 * @param modelKey - The stable model identifier (e.g. "user", "session"). Always used for the UID.
 * @param pluginName - The plugin identifier.
 * @param tableName - Optional configured model/table name from better-auth. When provided, used
 *   only for `collectionName` so the database table can be renamed without changing the UID.
 */
export function generateNames(
  modelKey: string,
  pluginName: string,
  tableName?: string,
) {
  const singularName = kebabCase(modelKey);
  const pluralName = singularName.endsWith("s")
    ? singularName
    : `${singularName}s`;

  const tableBase = tableName ? kebabCase(tableName) : singularName;

  const tablePrefix = strapi.config.get(
    `plugin::${pluginName}.table_prefix`,
    "ba_",
  );

  return {
    singularName,
    pluralName,
    collectionName: `${tablePrefix}${snakeCase(tableBase)}`,
    uid: `plugin::${pluginName}.${singularName}`,
    globalId: modelKey
      .split("-")
      .map((w) => upperFirst(camelCase(w)))
      .join(""),
    displayName: pluralName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  };
}

/**
 * Determines visibility in content manager (only user is visible)
 */
export function isVisible(modelName: string): boolean {
  return modelName === "user";
}
