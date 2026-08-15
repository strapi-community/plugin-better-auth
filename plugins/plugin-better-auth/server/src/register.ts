import { fromNodeHeaders } from "better-auth/node";
import type { ParameterizedContext } from "koa";
import restrictDocumentService from "./middlewares/restrict-document-service";
import { createContentApiRoutes } from "./routes";
import {
  getPluginService,
  isVersionAtLeast,
  MIN_STRAPI_VERSION,
  POSSIBLE_CONFIG_LOCATIONS,
} from "./utils";

export default () => {
  const strapiVersion = strapi.config.get<string>("info.strapi", "0.0.0");

  if (!isVersionAtLeast(strapiVersion, MIN_STRAPI_VERSION)) {
    throw new Error(
      `[@strapi-community/plugin-better-auth] Strapi v${strapiVersion} is not supported. ` +
        `Please upgrade to Strapi v${MIN_STRAPI_VERSION} or higher.`,
    );
  }

  strapi.documents.use(restrictDocumentService);

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
   * Throw an error if the users-permissions plugin is installed. Migration path will be provided later.
   */
  if (usersPermissionsPlugin) {
    throw new Error(
      "[@strapi-community/plugin-better-auth] The 'users-permissions' plugin is installed. " +
        "Better Auth and users-permissions cannot be used together.",
    );
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
