import type { Modules, UID } from "@strapi/strapi";
import type { Where } from "better-auth/types";

/**
 * Transform Better Auth where clause to Strapi filters
 */
export const transformFilters = (
  where: Where[],
  model: string,
  getFieldName: (args: { model: string; field: string }) => string,
) => {
  if (!where) {
    return {};
  }

  // Handle array format: [{ field, operator, value, connector }]
  if (Array.isArray(where)) {
    if (where.length === 0) {
      return {};
    }

    const filters: Modules.Documents.Params.Filters.Any<UID.ContentType> = {};
    const andConditions = [];
    const orConditions = [];

    for (const condition of where) {
      const fieldName = getFieldName({ model, field: condition.field });
      const insensitive = condition.mode === "insensitive";

      // Map the Better Auth operator to a Strapi filter condition. When
      // `mode` is "insensitive" we use Strapi's case-insensitive operator
      // variants ($eqi, $nei, $containsi, …). `in`/`not_in` have no
      // case-insensitive Strapi operator, so they are expanded into an
      // $or/$and group of $eqi/$nei conditions.
      let conditionFilter: Record<string, unknown>;

      switch (condition.operator) {
        case "eq":
          conditionFilter = {
            [fieldName]: insensitive
              ? { $eqi: condition.value }
              : { $eq: condition.value },
          };
          break;
        case "ne":
          conditionFilter = {
            [fieldName]: insensitive
              ? { $nei: condition.value }
              : { $ne: condition.value },
          };
          break;
        case "in":
          conditionFilter = insensitive
            ? {
                $or: (condition.value as unknown[]).map((value) => ({
                  [fieldName]: { $eqi: value },
                })),
              }
            : { [fieldName]: { $in: condition.value } };
          break;
        case "not_in":
          conditionFilter = insensitive
            ? {
                $and: (condition.value as unknown[]).map((value) => ({
                  [fieldName]: { $nei: value },
                })),
              }
            : { [fieldName]: { $notIn: condition.value } };
          break;
        case "gt":
          conditionFilter = { [fieldName]: { $gt: condition.value } };
          break;
        case "gte":
          conditionFilter = { [fieldName]: { $gte: condition.value } };
          break;
        case "lt":
          conditionFilter = { [fieldName]: { $lt: condition.value } };
          break;
        case "lte":
          conditionFilter = { [fieldName]: { $lte: condition.value } };
          break;
        case "contains":
          conditionFilter = {
            [fieldName]: insensitive
              ? { $containsi: condition.value }
              : { $contains: condition.value },
          };
          break;
        case "starts_with":
          conditionFilter = {
            [fieldName]: insensitive
              ? { $startsWithi: condition.value }
              : { $startsWith: condition.value },
          };
          break;
        case "ends_with":
          conditionFilter = {
            [fieldName]: insensitive
              ? { $endsWithi: condition.value }
              : { $endsWith: condition.value },
          };
          break;
        default:
          conditionFilter = {
            [fieldName]: insensitive
              ? { $eqi: condition.value }
              : { $eq: condition.value },
          };
      }

      // Handle connector
      if (condition.connector === "OR") {
        orConditions.push(conditionFilter);
      } else {
        // Default to AND
        andConditions.push(conditionFilter);
      }
    }

    // Build final filters. Several AND conditions go in `$and` rather than
    // being merged into one object: merging would let a later condition on the
    // same field overwrite an earlier one, so a range such as
    // `createdAt > start AND createdAt <= end` would lose its lower bound.
    if (andConditions.length === 1) {
      Object.assign(filters, andConditions[0]);
    } else if (andConditions.length > 1) {
      filters.$and = andConditions;
    }

    if (orConditions.length > 0) {
      filters.$or = orConditions;
    }

    return filters;
  }

  // Handle object format: { field: value } or { field: { $operator: value } }
  if (Object.keys(where).length === 0) {
    return {};
  }

  const filters: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(where)) {
    const fieldName = getFieldName({ model, field: key });

    if (value && typeof value === "object") {
      // Handle operators like $eq, $ne, $in, etc.
      if ("$eq" in value) {
        filters[fieldName] = { $eq: value.$eq };
      } else if ("$ne" in value) {
        filters[fieldName] = { $ne: value.$ne };
      } else if ("$in" in value) {
        filters[fieldName] = { $in: value.$in };
      } else if ("$nin" in value) {
        filters[fieldName] = { $notIn: value.$nin };
      } else if ("$gt" in value) {
        filters[fieldName] = { $gt: value.$gt };
      } else if ("$gte" in value) {
        filters[fieldName] = { $gte: value.$gte };
      } else if ("$lt" in value) {
        filters[fieldName] = { $lt: value.$lt };
      } else if ("$lte" in value) {
        filters[fieldName] = { $lte: value.$lte };
      } else if ("$contains" in value) {
        filters[fieldName] = { $contains: value.$contains };
      } else if ("$startsWith" in value) {
        filters[fieldName] = { $startsWith: value.$startsWith };
      } else if ("$endsWith" in value) {
        filters[fieldName] = { $endsWith: value.$endsWith };
      } else {
        filters[fieldName] = value;
      }
    } else {
      filters[fieldName] = { $eq: value };
    }
  }

  return filters as Modules.Documents.Params.Filters.Any<UID.ContentType>;
};
