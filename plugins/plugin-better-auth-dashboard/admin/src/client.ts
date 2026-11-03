import type { dash } from "@better-auth/infra";
import { dashClient } from "@better-auth/infra/client";
import { createAuthClient, InferPlugin } from "better-auth/client";

// better-auth's proxy defaults to GET when the request body is empty.
// This plugin declares the correct method for all /dash/ POST endpoints so the
// proxy never has to guess — avoiding the need for { fetchOptions: { method: "POST" } }
// workarounds at each call site.
const dashPathMethods = (): {
  id: string;
  pathMethods: Record<string, "GET" | "POST">;
} => ({
  id: "dash-path-methods",
  pathMethods: {
    "/dash/organization/directory/create": "POST",
    "/dash/organization/directory/delete": "POST",
    "/dash/organization/directory/regenerate-token": "POST",
    "/dash/execute-adapter": "POST",
    "/dash/complete-invitation": "POST",
    "/dash/check-user-exists": "POST",
    "/dash/organization/invite-member": "POST",
    "/dash/organization/check-user-by-email": "POST",
    "/dash/organization/cancel-invitation": "POST",
    "/dash/organization/resend-invitation": "POST",
    "/dash/organization/add-member": "POST",
    "/dash/organization/remove-member": "POST",
    "/dash/organization/update-member-role": "POST",
    "/dash/organization/delete": "POST",
    "/dash/organization/delete-many": "POST",
    "/dash/organization/create": "POST",
    "/dash/organization/update": "POST",
    "/dash/organization/update-team": "POST",
    "/dash/organization/delete-team": "POST",
    "/dash/organization/create-team": "POST",
    "/dash/organization/add-team-member": "POST",
    "/dash/organization/remove-team-member": "POST",
    "/dash/sessions/revoke": "POST",
    "/dash/sessions/revoke-all": "POST",
    "/dash/sessions/revoke-many": "POST",
    "/dash/organization/:id/sso-provider/create": "POST",
    "/dash/organization/:id/sso-provider/update": "POST",
    "/dash/organization/:id/sso-provider/request-verification-token": "POST",
    "/dash/organization/:id/sso-provider/verify-domain": "POST",
    "/dash/organization/:id/sso-provider/delete": "POST",
    "/dash/organization/:id/sso-provider/mark-domain-verified": "POST",
    "/dash/enable-two-factor": "POST",
    "/dash/view-two-factor-totp-uri": "POST",
    "/dash/view-backup-codes": "POST",
    "/dash/disable-two-factor": "POST",
    "/dash/generate-backup-codes": "POST",
    "/dash/delete-user": "POST",
    "/dash/delete-many-users": "POST",
    "/dash/create-user": "POST",
    "/dash/set-password": "POST",
    "/dash/unlink-account": "POST",
    "/dash/update-user": "POST",
    "/dash/ban-user": "POST",
    "/dash/ban-many-users": "POST",
    "/dash/unban-user": "POST",
    "/dash/send-verification-email": "POST",
    "/dash/send-many-verification-emails": "POST",
    "/dash/send-reset-password-email": "POST",
  },
});

const STORAGE_KEYS = {
  TOKEN: "jwtToken",
  USER: "userInfo",
};

/**
 * Retrieves the value of a specified cookie.
 */
export const getCookieValue = (name: string): string | null => {
  let result = null;
  const cookieArray = document.cookie.split(";");
  cookieArray.forEach((cookie) => {
    const [key, value] = cookie.split("=").map((item) => item.trim());
    if (key === name) {
      result = decodeURIComponent(value);
    }
  });
  return result;
};

export const getToken = (): string | null | undefined => {
  const fromLocalStorage = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (fromLocalStorage) {
    return JSON.parse(fromLocalStorage) as string;
  }

  const fromCookie = getCookieValue(STORAGE_KEYS.TOKEN);
  return fromCookie ?? null;
};

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Better Auth client pointed at the admin proxy (/auth).
 *
 * Auth is handled at the route level (Strapi JWT in Authorization header).
 * InferPlugin<ReturnType<typeof dash>> exposes all server-side dash() endpoints
 * with full TypeScript type inference.
 *
 * For endpoints that need JWT context (userId, organizationId, etc.), use the
 * withContext() helper from utils/dashContext.ts as the second argument.
 */
export const client = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/auth",
  plugins: [
    dashClient(),
    dashPathMethods(),
    InferPlugin<ReturnType<typeof dash>>(),
  ],
  fetchOptions: {
    onRequest: ({ headers }) => {
      const token = getToken();

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      } else {
        headers.delete("Authorization");
      }
    },
  },
});
