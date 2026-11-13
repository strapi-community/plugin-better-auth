import type { Core } from "@strapi/types";
import type { Context } from "koa";
import type { Auth } from "../../types/better-auth";

/**
 * Shared secret between this Strapi backend and the Better Auth `dash()` server
 * plugin. Every dash request is authorized by presenting its SHA-256 hash inside
 * a short-lived JWT — a server-to-server trust, so no end-user session is needed.
 */
export const DASHBOARD_API_KEY =
  process.env.BETTER_AUTH_DASHBOARD_SECRET || "strapi-internal-dashboard-key";

/**
 * Header the admin client uses to pass dash() JWT context (userId, organizationId,
 * ...) separately from the HTTP payload, as base64(JSON).
 */
export const DASH_CONTEXT_HEADER = "x-dash-context";

/**
 * Decode the base64(JSON) dash context header (e.g. `{ userId }`). Returns an
 * empty object when the header is missing or malformed.
 */
export function decodeDashContextHeader(
  value: string | string[] | undefined,
): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed context header — proceed without extra context.
  }
  return {};
}

export async function hashApiKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mint the short-lived JWT the dash() plugin expects: the api-key hash plus any
 * context fields (e.g. `{ userId }`) the target endpoint reads from its payload.
 * Requires the Better Auth `jwt()` plugin (`auth.api.signJWT`).
 */
export async function signDashToken(
  auth: Auth,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { token } = await auth.api.signJWT({
    body: {
      payload: {
        iat: Math.floor(Date.now() / 1000),
        apiKeyHash: await hashApiKey(DASHBOARD_API_KEY),
        ...extra,
      },
      overrideOptions: { jwt: { expirationTime: "5m" } },
    },
  });
  return token;
}

function getAuth(strapi: Core.Strapi): Auth {
  const auth = strapi
    .service("plugin::better-auth.auth-service")
    .getAuth() as Auth | null;

  if (!auth) {
    throw new Error("No Better Auth configuration was found.");
  }
  if (!auth.api?.signJWT) {
    throw new Error(
      "The Better Auth jwt() plugin is required for dashboard/MCP features. " +
        "Add jwt() from 'better-auth/plugins' to your Better Auth configuration.",
    );
  }
  return auth;
}

/**
 * Server-side access to the Better Auth `dash()` endpoints for code that has no
 * incoming HTTP request (e.g. the MCP tools).
 *
 * Returns the Better Auth instance together with the headers that authorize a
 * dash call: a short-lived JWT carrying the api-key hash plus any `context`
 * (e.g. `{ userId }`) the target endpoint reads from its payload. Callers then
 * invoke the typed dash methods directly, for example:
 *
 * ```ts
 * const { auth, headers } = await getDashApi(strapi, { userId });
 * await auth.api.dashBanUser({ body: { banReason }, headers });
 * ```
 *
 * The dash endpoints are the only ones callable without a user session (they use
 * the shared api-key instead), which is why server-side callers go through them.
 */
export async function getDashApi(
  strapi: Core.Strapi,
  context: Record<string, unknown> = {},
): Promise<{ auth: Auth; headers: Headers }> {
  const auth = getAuth(strapi);
  const token = await signDashToken(auth, context);
  return { auth, headers: new Headers({ Authorization: `Bearer ${token}` }) };
}

/**
 * Proxy an incoming Koa request to a Better Auth endpoint and copy the full
 * response back onto `ctx` (status, headers — including `Set-Cookie` — and body).
 *
 * This is the shared passthrough behind both proxies: the admin panel proxy
 * (`auth-controller`, generic `/auth/*`) and the third-party dash gateway
 * (`dash-api-controller`, scoped to `dash/*`). The two differ only in their route
 * auth and the `targetPath` they forward to. Dash context is taken from the
 * `X-Dash-Context` header, and the Authorization header is replaced with the
 * signed dash JWT.
 *
 * `targetPath` is the path under `/api/auth/` to forward to (e.g. `"dash/list-users"`
 * or `"get-session"`); the original query string is preserved.
 */
export async function proxyDashRequest(
  strapi: Core.Strapi,
  ctx: Context,
  targetPath: string,
): Promise<void> {
  const auth = getAuth(strapi);
  const token = await signDashToken(
    auth,
    decodeDashContextHeader(ctx.request.headers[DASH_CONTEXT_HEADER]),
  );

  // Preserve the original query string; only swap the path to the Better Auth one.
  const url = new URL(
    ctx.request.url,
    `${ctx.request.protocol}://${ctx.request.host}`,
  );
  url.pathname = `/api/auth/${targetPath}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(ctx.request.headers)) {
    if (value)
      headers.set(key, Array.isArray(value) ? value[0] : String(value));
  }
  headers.set("Authorization", `Bearer ${token}`);

  const hasBody = ctx.request.method !== "GET" && ctx.request.method !== "HEAD";

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
}
