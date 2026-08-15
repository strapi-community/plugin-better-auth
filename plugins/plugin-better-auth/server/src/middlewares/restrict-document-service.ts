import type { Modules } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import { isInternalCall } from "../adapter/internal-context";
import { PLUGIN_ID } from "../utils";

/**
 * Document service actions that write data. Reads (`findOne`/`findMany`/`count`) are
 * left unrestricted since they don't bypass any Better Auth business logic.
 */
const WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "create",
  "update",
  "delete",
  "createMany",
  "updateMany",
  "deleteMany",
]);

/**
 * Restricts direct document service writes to Better Auth's own content types
 * (`plugin::better-auth.*`, e.g. `user`, `session`, `account`).
 *
 * Better Auth's data carries business logic that needs to run alongside its CRUD
 * operations - for example, creating a complementary account when a user is created.
 * Writing to these content types straight through `strapi.documents(...)` bypasses
 * that logic, so it's blocked here unless:
 *
 * - The call is internal, i.e. issued by the Better Auth adapter itself (or another
 *   trusted first-party caller) via `runAsInternalCall`.
 * - The `unsafe_document_service` config option is set to `true`.
 *
 * @see https://github.com/strapi-community/plugin-better-auth/issues/18
 */
const restrictDocumentService: Modules.Documents.Middleware.Middleware = async (
  context,
  next,
) => {
  const { action, contentType } = context;

  if (!contentType.uid.startsWith(`plugin::${PLUGIN_ID}.`)) {
    return next();
  }

  if (!WRITE_ACTIONS.has(action)) {
    return next();
  }

  if (isInternalCall()) {
    return next();
  }

  const unsafeDocumentService = strapi.config.get<boolean>(
    `plugin::${PLUGIN_ID}.unsafe_document_service`,
    false,
  );

  if (unsafeDocumentService) {
    return next();
  }

  throw new errors.ApplicationError(
    `[@strapi-community/plugin-better-auth] Direct document service writes to "${contentType.uid}" are restricted, ` +
      "as they bypass Better Auth's own business logic for this operation. " +
      "Use the Better Auth API instead, or set the 'unsafe_document_service' config option to true to disable this restriction.",
  );
};

export default restrictDocumentService;
