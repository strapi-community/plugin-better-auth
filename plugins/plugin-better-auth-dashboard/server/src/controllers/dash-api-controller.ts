import { errors } from "@strapi/utils";
import type { Context } from "koa";
import { proxyDashRequest } from "../utils/dash";

/**
 * Third-party HTTP gateway to the Better Auth `dash()` endpoints.
 *
 * Mounted at `/api/better-auth-dashboard/dash/:path*` only when the opt-in
 * `dashApi.enabled` config is set (see register.ts), so it simply doesn't exist
 * when the feature is off. Authentication is Strapi's standard content-api auth
 * with a Strapi API token.
 *
 * It shares the {@link proxyDashRequest} passthrough with the admin proxy, but is
 * scoped to `dash/*` — it forwards only to `/api/auth/dash/<path>`, never the rest
 * of the Better Auth surface.
 */
const dashApiController = () => ({
  async handleDashRequest(ctx: Context) {
    const path = (ctx.params as { path?: string }).path;
    if (!path) {
      throw new errors.ValidationError("Missing dash endpoint path.");
    }

    await proxyDashRequest(strapi, ctx, `dash/${path}`);
  },
});

export default dashApiController;
