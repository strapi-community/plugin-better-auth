import { fromNodeHeaders } from "better-auth/node";
import type { ParameterizedContext } from "koa";
import {
  declaresForeignKeys,
  removeOrphanedRows,
} from "./migrations/remove-orphaned-rows";
import { createContentApiRoutes } from "./routes";
import {
  getPluginService,
  isMigrationEnabled,
  isVersionAtLeast,
  MIN_STRAPI_VERSION,
} from "./utils";

export default () => {
  const strapiVersion = strapi.config.get<string>("info.strapi", "0.0.0");

  if (!isVersionAtLeast(strapiVersion, MIN_STRAPI_VERSION)) {
    throw new Error(
      `[@strapi-community/plugin-better-auth] Strapi v${strapiVersion} is not supported. ` +
        `Please upgrade to Strapi v${MIN_STRAPI_VERSION} or higher.`,
    );
  }

  const apiPermissionsPlugin = strapi.plugin("api-permissions");
  const usersPermissionsPlugin = strapi.plugin("users-permissions");
  const auth = getPluginService("auth-service").getAuth();

  /**
   * Throw an error if the better-auth config is missing, as the plugin cannot function without it.
   */
  if (!auth) {
    throw new Error(
      "[@strapi-community/plugin-better-auth] No Better Auth configuration was found. " +
        "There should be an auth.js|ts file in ./, ./lib or ./src/lib with a default export or named export 'auth'.",
    );
  }

  /**
   * Better Auth and users-permissions cannot be used together, so normally the
   * plugin refuses to boot when users-permissions is installed. The exception is
   * migration mode (see `migration.enabled` config): both are allowed to load so
   * the bootstrap step can read users-permissions data and migrate it across.
   */
  if (usersPermissionsPlugin) {
    if (!isMigrationEnabled()) {
      throw new Error(
        "[@strapi-community/plugin-better-auth] The 'users-permissions' plugin is installed. " +
          "Better Auth and users-permissions cannot be used together. To migrate, enable " +
          "the 'migration' option (see the migration guide).",
      );
    }

    strapi.log.warn(
      "[@strapi-community/plugin-better-auth] MIGRATION MODE: running alongside 'users-permissions'. " +
        "Once the migration has completed, remove the users-permissions plugin and disable the " +
        "'migration' option.",
    );
  }

  /**
   * Clean up rows orphaned before the foreign keys existed, as they'd block the schema sync
   * from adding them. Strapi runs it once, before the sync, on the first boot where the
   * schema (generated with `npx auth generate`) declares the foreign keys.
   */
  if (declaresForeignKeys(strapi)) {
    strapi.db.migrations.providers.internal.register(removeOrphanedRows);
  }

  /**
   * Register routes dynamically based on the basePath configured in the better-auth instance.
   * The content-api router already has the api prefix (e.g. /api) so we strip it from basePath
   * to avoid doubling it in the final URL.
   */
  const apiPrefix = strapi.config.get("api.rest.prefix", "/api") as string;
  const basePath =
    "basePath" in auth.options
      ? (auth.options.basePath as string)
      : "/api/auth";
  const routePath = basePath.startsWith(apiPrefix)
    ? basePath.slice(apiPrefix.length) || "/"
    : basePath;

  strapi.server.routes(createContentApiRoutes(routePath));

  /**
   * Warn if the plugin-api-permissions is not installed, as the content API authentication will not work without it.
   */
  if (!apiPermissionsPlugin) {
    strapi.log.warn(
      "[@strapi-community/plugin-better-auth] plugin-api-permissions is not installed. " +
        "Content API authentication will not work.",
    );

    return;
  }

  /**
   * Register a session resolver for the auth strategy of the API permissions plugin.
   */
  apiPermissionsPlugin
    .service("session")
    .registerSessionResolver(async (ctx: ParameterizedContext) => {
      if (!auth?.api?.getSession) return null;

      const headers = fromNodeHeaders(ctx.request.headers);
      const session = await auth.api.getSession({ headers });

      if (!session?.user?.id) return null;

      const userId = Number(session.user.id);

      const user = await strapi
        .documents("plugin::better-auth.user")
        .findFirst({
          filters: { id: userId },
          populate: ["roles"],
        });

      if (!user) return null;

      ctx.state.user = user;

      return { user, roles: user.roles };
    });
};
