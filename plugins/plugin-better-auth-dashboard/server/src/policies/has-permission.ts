import type { Core } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import type { Context } from "koa";
import {
  ALL_ACTIONS,
  type DashAction,
  getDashRule,
  getDbRule,
  isBetterAuthUid,
  RELATION_SEARCH_ACTIONS,
  toActionId,
} from "../permissions";
import { canReadInContentManager } from "../utils/content-manager";

const { PolicyError } = errors;

export type HasPermissionConfig = {
  /** Which group of admin routes this policy guards. */
  route: "dash" | "db" | "settings";
};

type Ability = { can: (action: string, subject?: unknown) => boolean };

const DB_OPERATIONS = {
  GET: "list",
  PUT: "update",
  DELETE: "delete",
} as const;

function canAccessDb(
  strapi: Core.Strapi,
  ctx: Context,
  hasAny: (actions: DashAction[]) => boolean,
): boolean {
  const op = DB_OPERATIONS[ctx.request.method as keyof typeof DB_OPERATIONS];
  // Policies get a copy of ctx's own properties only, so the `ctx.query`
  // getter isn't there; read it from the request.
  const { uid } = ctx.request.query as { uid?: unknown };
  if (!op || typeof uid !== "string" || !(uid in strapi.contentTypes)) {
    return false;
  }
  if (uid.startsWith("admin::")) return false;

  if (isBetterAuthUid(uid)) {
    const anyOf = getDbRule(uid, op);
    return !!anyOf && hasAny(anyOf);
  }

  // Any other content type can only be searched (custom relation fields in a
  // detail drawer), and only if the Content Manager would show it too.
  return (
    op === "list" &&
    hasAny(RELATION_SEARCH_ACTIONS) &&
    canReadInContentManager(strapi, ctx.state.userAbility, uid)
  );
}

/**
 * Lets an admin call a dashboard route only when their role grants the
 * dashboard permission the admin panel requires for the same action. See
 * `../permissions.ts` for the mapping. Anything unmapped is denied.
 */
export default (
  ctx: Context,
  config: HasPermissionConfig,
  { strapi }: { strapi: Core.Strapi },
) => {
  const ability = ctx.state.userAbility as Ability | undefined;
  if (!ctx.state.user || !ability) {
    throw new PolicyError("You do not have permission to see this content.");
  }

  const hasAny = (actions: DashAction[]) =>
    actions.some((action) => ability.can(toActionId(action)));

  let allowed = false;
  switch (config?.route) {
    case "dash": {
      const anyOf = getDashRule(
        ctx.request.method,
        (ctx.params as { path?: string }).path,
      );
      allowed = !!anyOf && hasAny(anyOf);
      break;
    }
    case "settings":
      allowed = hasAny(ALL_ACTIONS);
      break;
    case "db":
      allowed = canAccessDb(strapi, ctx, hasAny);
      break;
  }

  if (!allowed) {
    throw new PolicyError("You do not have permission to see this content.");
  }
  return true;
};
