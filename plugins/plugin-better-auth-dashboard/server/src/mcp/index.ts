import type { Core } from "@strapi/types";
import { USER_UID } from "./constants";
import { getMcp, userHasAttribute } from "./shared";
import { registerBanTools } from "./tools/ban-user";
import { registerGetUser } from "./tools/get-user";
import { registerListUsers } from "./tools/list-users";
import { registerSignupsGraph } from "./tools/signups-graph";
import { registerUpdateUser } from "./tools/update-user";
import { registerUserStats } from "./tools/user-stats";

/**
 * Register this plugin's Better Auth admin + analytics tools on Strapi's native
 * MCP server (`strapi.ai.mcp`).
 *
 * Every tool calls the Better Auth `dash()` plugin endpoints — the same path the
 * dashboard admin UI uses — so Better Auth's own business logic runs (validation,
 * ban side-effects, stats aggregation). This requires the consumer to have
 * `dash()` + `jwt()` configured (already a hard requirement of this plugin).
 *
 * Call only from the plugin's `register()` phase — the MCP HTTP server starts
 * during bootstrap, and registering afterwards throws.
 *
 * Guards:
 *  - `strapi.ai.mcp` is absent on Strapi < 5.47, so the whole thing no-ops there.
 *  - Ban tools depend on the admin plugin's `banned` field, so they are only
 *    registered when it exists on the `user` schema (matches dashboard behaviour).
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

  // Admin actions the dashboard also offers.
  registerListUsers(mcp);
  registerGetUser(mcp);
  registerUpdateUser(mcp);

  // Analytics (dashboard Overview).
  registerUserStats(mcp);
  registerSignupsGraph(mcp);

  // Ban/unban — only when the Better Auth admin plugin is configured.
  if (userHasAttribute(strapi, USER_UID, "banned")) {
    registerBanTools(mcp);
  }

  strapi.log.info(
    "[@strapi-community/plugin-better-auth-dashboard] Registered Better Auth MCP tools.",
  );
}
