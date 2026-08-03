// Types
import type { Core } from "@strapi/strapi";
// Utils
import { errors } from "@strapi/utils";
import type { Context } from "koa";

const { PolicyError } = errors;

type Route = {
  method: string;
  path: string;
  handler: string;
  config: unknown;
  info: unknown;
};

// references to categories by path start
const endpointsCategories = Object.freeze({
  "/auth/dash/config": ["overview", "user", "organization"],
  "/auth/dash/user-stats": ["overview"],
  "/auth/dash/user-graph-data": ["overview"],
  "/auth/dash/user-retention-data": ["overview"],
  "/auth/dash/list-users": ["overview", "user"],
  "/auth/dash/list-organization": ["overview", "organization"],
  "/auth/dash/user": ["user"],
  "/auth/dash/organization": ["organization"],
});

// references to actions by method
const types = Object.freeze({
  POST: "read",
  PUT: "update",
  GET: "read",
  DELETE: "delete",
});

// references to predictable actions
const endpointsTypes = Object.freeze({
  "/auth/dash/user-stats": "read",
  "/auth/dash/user-graph-data": "read",
  "/auth/dash/user-retention-data": "read",
  "/auth/dash/list-users": "read",
  "/auth/dash/list-organizations": "read",
  "/auth/dash/organization/options": "read",
  "/auth/dash/create-user": "create",
  "/auth/dash/update-user": "update",
  "/auth/dash/user": "read",
  "/auth/dash/delete-user": "delete",
  "/auth/dash/organization/create": "create",
  "/auth/dash/organization/delete": "delete",
});

export default async (
  ctx: Context,
  _: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const { user, route } = ctx.state as {
    user: { roles: { id: number }[] };
    route: Route;
  };
  if (!user) return false;

  const inherentType = types[route.method as keyof typeof types];
  const determinedType =
    endpointsTypes?.[
      Object.keys(endpointsTypes)?.find((k) =>
        ctx.originalUrl?.includes(k),
      ) as keyof typeof endpointsTypes
    ];

  const found = [];
  for await (const role of user.roles) {
    const categories =
      endpointsCategories[
        Object.keys(endpointsCategories).find((key) =>
          ctx.originalUrl.startsWith(key),
        ) as keyof typeof endpointsCategories
      ];
    const permissions = await strapi.documents("admin::permission").findMany({
      filters: {
        $or: (categories || []).map((cat) => ({
          role: { id: role.id },
          action: {
            $startsWith: "plugin::better-auth-dashboard",
            $containsi: cat,
            $endsWith: determinedType || inherentType,
          },
        })),
      },
    });

    if (permissions?.length > 0) found.push(...permissions);
  }

  if (found.length <= 0) {
    throw new PolicyError("You do not have permission to see this content.");
  }

  return true;
};
