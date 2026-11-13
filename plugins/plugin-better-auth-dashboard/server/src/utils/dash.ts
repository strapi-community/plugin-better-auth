import type { Core } from "@strapi/types";
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
 * Server-side call to a Better Auth `dash()` endpoint — the same mechanism the
 * dashboard admin proxy uses, without an incoming HTTP request. Signs the dash
 * JWT (api-key hash + `context`) and invokes `auth.handler` at
 * `/api/auth/dash/<path>`, returning the parsed JSON response.
 *
 * This is the single entry point the MCP tools use so they go through Better
 * Auth's own business logic (validation, ban side-effects, stats aggregation)
 * rather than touching the document service directly.
 */
export async function callDash(
  strapi: Core.Strapi,
  opts: {
    path: string;
    method?: "GET" | "POST";
    query?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
    context?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { path, method = "GET", query, body, context } = opts;
  const auth = getAuth(strapi);

  const token = await signDashToken(auth, context ?? {});

  // The dashboard only supports Better Auth's default basePath (/api/auth); the
  // request host is irrelevant since auth.handler routes by pathname.
  const base = process.env.STRAPI_URL || "http://127.0.0.1:1337";
  const url = new URL(`${base}/api/auth/dash/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const request = new Request(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method !== "GET" && body ? JSON.stringify(body) : undefined,
  });

  const response = await auth.handler(request);
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: response.status < 400, status: response.status, data };
}
