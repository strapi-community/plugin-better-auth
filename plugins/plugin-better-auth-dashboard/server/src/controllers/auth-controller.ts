import type { Context } from "koa";
import { proxyDashRequest } from "../utils/dash";

/**
 * Admin-panel proxy to Better Auth.
 *
 * Mounted on the admin routes (`/auth/:path*`, gated by the `has-permission`
 * policy) and used by the dashboard's Better Auth client. It forwards the request
 * to `/api/auth/<path>` via the shared {@link proxyDashRequest} passthrough, which
 * signs the dash JWT and copies the full response back.
 */
const proxyController = () => ({
  async handleAuthRequest(ctx: Context) {
    await proxyDashRequest(strapi, ctx, (ctx.params.path as string) || "");
  },
});

export default proxyController;
