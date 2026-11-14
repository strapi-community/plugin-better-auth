const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function coerceDateString(value: string): string | Date {
  if (!ISO_DATETIME_REGEX.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function coerceDateValues<T>(value: T): T {
  if (typeof value === "string") {
    return coerceDateString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => coerceDateValues(item)) as T;
  }

  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  const coerced = Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      coerceDateValues(nestedValue),
    ]),
  );

  return coerced as T;
}

export function transformOutput<T>(record: T, useDocumentId = false): T {
  const coerced = coerceDateValues(record);

  // When Better Auth ids are not serial, the adapter maps them onto Strapi's
  // `documentId` (Strapi's `id` stays a numeric auto-increment that Better Auth
  // never sees). Expose `documentId` back as `id` so Better Auth reads the value
  // it stored.
  if (
    useDocumentId &&
    coerced &&
    typeof coerced === "object" &&
    "documentId" in coerced
  ) {
    (coerced as Record<string, unknown>).id = (
      coerced as Record<string, unknown>
    ).documentId;
  }

  return coerced;
}
