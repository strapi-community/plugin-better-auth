import { errors } from "@strapi/utils";
import type { Context } from "koa";
import type { Auth } from "../../types/better-auth";
import {
  DASH_CONTEXT_HEADER,
  decodeDashContextHeader,
  signDashToken,
} from "../utils/dash";

const proxyController = () => ({
  async handleAuthRequest(ctx: Context) {
    const auth = strapi
      .service("plugin::better-auth.auth-service")
      .getAuth() as Auth | null;

    if (!auth)
      throw new errors.ApplicationError("No Better Auth config file found");

    if (!auth.api.signJWT) {
      throw new errors.ApplicationError(
        "[@strapi-community/plugin-better-auth-dashboard] The better-auth JWT plugin is required. " +
          "Add jwt() from 'better-auth/plugins' to your better-auth configuration.",
      );
    }

    // Read JWT context from the dedicated X-Dash-Context header.
    // The admin client base64-encodes the context JSON and sets this header,
    // keeping context fields cleanly separated from the HTTP payload.
    const extra = decodeDashContextHeader(
      ctx.request.headers[DASH_CONTEXT_HEADER],
    );

    const token = await signDashToken(auth, extra);

    // Create a Request object compatible with Better Auth
    const url = new URL(
      ctx.request.url,
      `${ctx.request.protocol}://${ctx.request.host}`,
    );

    // Update the URL path to the Better Auth format
    const betterAuthPath = ctx.params.path || "";
    url.pathname = `/api/auth/${betterAuthPath}`;

    // Prepare headers
    const headers = new Headers();
    Object.entries(ctx.request.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : String(value));
      }
    });

    // Set the Authorization header with the signed JWT
    headers.set("Authorization", `Bearer ${token}`);

    const hasBody =
      ctx.request.method !== "GET" && ctx.request.method !== "HEAD";

    // Create the Request object
    const request = new Request(url.toString(), {
      method: ctx.request.method,
      headers: headers,
      body: hasBody ? JSON.stringify(ctx.request.body) : undefined,
    });

    // Call Better Auth handler
    const response = await auth.handler(request);

    // Set response status
    ctx.status = response.status;

    // Copy response headers
    response.headers.forEach((value: string, key: string) => {
      ctx.set(key, value);
    });

    // Get response body — read as text first to avoid JSON.parse errors on empty bodies
    // (e.g. deleteUser returns undefined, which better-call serializes as content-type:json + no body)
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

export default proxyController;
