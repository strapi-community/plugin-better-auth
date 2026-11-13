import type { Core } from "@strapi/types";
import { USER_UID } from "./constants";
import { getMcp, userHasAttribute } from "./shared";
import { registerBanTools } from "./tools/ban-user";
import { registerGetUser } from "./tools/get-user";
import { registerListUsers } from "./tools/list-users";
import { registerSetUserRole } from "./tools/set-user-role";
import { registerSignupsOverTime } from "./tools/signups-over-time";
import { registerUpdateUser } from "./tools/update-user";
import { registerUserStats } from "./tools/user-stats";

/**
 * Register this plugin's Better Auth admin + analytics tools on Strapi's native
 * MCP server (`strapi.ai.mcp`).
 *
 * Call this only from the plugin's `register()` phase — the MCP HTTP server
 * starts during bootstrap, and registering afterwards throws. The caller is
 * responsible for the opt-in config check; this function assumes it should run.
 *
 * Guards:
 *  - `strapi.ai.mcp` is absent on Strapi < 5.47, so the whole thing no-ops there.
 *  - Ban/role tools depend on attributes the Better Auth admin plugin adds, so
 *    they are only registered when those attributes exist on the `user` schema.
 */
export function registerMcpTools(strapi: Core.Strapi) {
  const mcp = getMcp(strapi);
  if (!mcp) {
    strapi.log.warn(
      "[@strapi-community/plugin-better-auth-dashboard] MCP integration is enabled " +
        "but this Strapi version has no MCP server (requires >= 5.47). Skipping.",
    );
    return;
  }

  // Always available (document-service based).
  registerListUsers(mcp);
  registerGetUser(mcp);
  registerUpdateUser(mcp);
  registerUserStats(strapi, mcp);
  registerSignupsOverTime(mcp);

  // Admin-plugin dependent tools.
  if (userHasAttribute(strapi, USER_UID, "banned")) {
    registerBanTools(mcp);
  }
  if (userHasAttribute(strapi, USER_UID, "role")) {
    registerSetUserRole(mcp);
  }

  strapi.log.info(
    "[@strapi-community/plugin-better-auth-dashboard] Registered Better Auth MCP tools.",
  );
}
