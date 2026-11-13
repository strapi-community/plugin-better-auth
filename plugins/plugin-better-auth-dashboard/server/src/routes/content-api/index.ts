import type { Core } from "@strapi/types";

/**
 * Third-party gateway to the Better Auth dash() endpoints.
 *
 * Mounted via `strapi.server.routes()` (the same way plugin-better-auth mounts its
 * `/api/auth/*` proxy) under the content-api prefix at
 * `/api/better-auth-dashboard/dash/:path*`.
 *
 * Authentication uses Strapi's standard content-api auth: a **Strapi API token**
 * is authenticated by the built-in `content-api-token` strategy (which is tried
 * before plugin-api-permissions' strategy, so an API token is never shadowed by
 * it). The controller enforces the `dashApi.enabled` opt-in.
 */
const HTTP_METHODS: Core.Route["method"][] = ["GET", "POST"];

const contentApiRoutes: Core.Router = {
  type: "content-api",
  routes: HTTP_METHODS.map((method) => ({
    method,
    path: "/better-auth-dashboard/dash/:path*",
    handler: "dash-controller.handleDashRequest",
    info: { pluginName: "better-auth-dashboard" },
    config: {
      policies: [],
      prefix: "",
    },
  })),
};

export default contentApiRoutes;
