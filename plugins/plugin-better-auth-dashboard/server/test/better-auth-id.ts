/**
 * The Better Auth id of a record created through Strapi's Document Service.
 *
 * Under Better Auth's native id strategy (the default) the id is stored as the
 * record's string `documentId`; under `generateId: "serial"` it is the numeric
 * `id`. Asks the better-auth plugin which strategy is active, so the tests work
 * against either playground.
 */
export function betterAuthId(record: {
  id: number | string;
  documentId: string;
}): string {
  const authService = strapi.plugin("better-auth").service("auth-service") as {
    usesDocumentId(): boolean;
  };

  return authService.usesDocumentId() ? record.documentId : String(record.id);
}
