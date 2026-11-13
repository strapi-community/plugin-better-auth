import { errors } from "@strapi/utils";
import type { Context } from "koa";
import {
  DASH_CONTEXT_HEADER,
  decodeDashContextHeader,
  getAuth,
  signDashToken,
} from "../utils/dash";

/**
 * Proxy to the Better Auth `dash()` endpoints, shared by both routes that need
 * server-injected api-key authorization:
 *
 *  - the admin panel — admin route `/auth/dash/:path*`, gated by `has-permission`;
 *  - the third-party gateway — content-api route `/better-auth-dashboard/dash/:path*`,
 *    gated by a Strapi API token (opt-in via `dashApi.enabled`).
 *
 * It signs the dash JWT (api-key hash + the `X-Dash-Context` fields), forwards the
 * request to `/api/auth/dash/<path>`, and copies the full response back. The routes
 * differ only in their authentication; the proxying is identical and always scoped
 * to `dash/*`. The rest of the Better Auth surface is already served publicly at
 * `/api/auth/*` by `plugin-better-auth`, so neither route needs to reach it.
 */
const dashController = () => ({
  async handleDashRequest(ctx: Context) {
    const path = (ctx.params as { path?: string }).path;
    if (!path) {
      throw new errors.ValidationError("Missing dash endpoint path.");
    }

    const auth = getAuth(strapi);
    const token = await signDashToken(
      auth,
      decodeDashContextHeader(ctx.request.headers[DASH_CONTEXT_HEADER]),
    );

    // Preserve the original query string; only swap the path to the dash endpoint.
    const url = new URL(
      ctx.request.url,
      `${ctx.request.protocol}://${ctx.request.host}`,
    );
    url.pathname = `/api/auth/dash/${path}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(ctx.request.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : String(value));
      }
    }
    headers.set("Authorization", `Bearer ${token}`);

    const hasBody =
      ctx.request.method !== "GET" && ctx.request.method !== "HEAD";

    const response = await auth.handler(
      new Request(url.toString(), {
        method: ctx.request.method,
        headers,
        body: hasBody ? JSON.stringify(ctx.request.body) : undefined,
      }),
    );

    ctx.status = response.status;
    response.headers.forEach((value: string, key: string) => {
      ctx.set(key, value);
    });

    // Read as text first to avoid JSON.parse errors on empty bodies (e.g. deleteUser
    // returns no body with content-type: application/json).
    const contentType = response.headers.get("content-type");
    const text = await response.text();
    if (!text) {
      ctx.body = {};
    } else if (contentType?.includes("application/json")) {
      ctx.body = JSON.parse(text);
    } else {
      ctx.body = text;
    }
  },
});

export default dashController;
