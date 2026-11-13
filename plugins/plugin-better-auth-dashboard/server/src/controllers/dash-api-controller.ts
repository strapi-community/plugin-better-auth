import { errors } from "@strapi/utils";
import type { Context } from "koa";
import {
  callDash,
  DASH_CONTEXT_HEADER,
  decodeDashContextHeader,
} from "../utils/dash";

/**
 * Third-party HTTP gateway to the Better Auth `dash()` endpoints.
 *
 * Mounted at `/api/better-auth-dashboard/dash/:path*` only when the opt-in
 * `dashApi.enabled` config is set (see register.ts), so it simply doesn't exist
 * when the feature is off. Authentication is Strapi's standard content-api auth
 * with a Strapi API token. It forwards the request to the matching dash endpoint
 * through {@link callDash} — the same signed-JWT mechanism the admin dashboard
 * uses — and passes the response straight back.
 *
 * Per-user/per-org context (e.g. `{ userId }`) is supplied via the base64(JSON)
 * `X-Dash-Context` header, exactly like the dashboard admin client.
 */
const dashApiController = () => ({
  async handleDashRequest(ctx: Context) {
    const path = (ctx.params as { path?: string }).path;
    if (!path) {
      throw new errors.ValidationError("Missing dash endpoint path.");
    }

    const method = ctx.method === "GET" ? "GET" : "POST";

    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(ctx.query ?? {})) {
      if (value === undefined) continue;
      query[key] = Array.isArray(value) ? value[0] : String(value);
    }

    const context = decodeDashContextHeader(
      ctx.request.headers[DASH_CONTEXT_HEADER],
    );

    const { status, data } = await callDash(strapi, {
      path,
      method,
      query,
      body:
        method === "POST"
          ? (ctx.request.body as Record<string, unknown>)
          : undefined,
      context,
    });

    ctx.status = status;
    ctx.body = data;
  },
});

export default dashApiController;
