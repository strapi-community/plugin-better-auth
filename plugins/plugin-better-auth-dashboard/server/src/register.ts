import type { Core } from "@strapi/types";
import type { Config } from "./config";
import { ACTIONS } from "./constants";
import { registerMcpTools } from "./mcp";
import { PLUGIN_ID } from "./utils";

export const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // construct appropriate actions to register based on installed plugins
  const actionsToRegister = [...ACTIONS.overview, ...ACTIONS.user];
  if (strapi.plugin("better-auth").contentTypes?.organization)
    actionsToRegister.push(...ACTIONS.organization);

  // register basic permission actions
  strapi.admin.services.permission.actionProvider.registerMany(
    actionsToRegister,
  );

  // Opt-in: register Better Auth MCP tools on Strapi's native MCP server.
  // Must happen in register() — the MCP server starts during bootstrap.
  const config = strapi.config.get<Config>(`plugin::${PLUGIN_ID}`, {});
  if (config.mcp?.enabled) {
    try {
      registerMcpTools(strapi);
    } catch (error) {
      strapi.log.warn(
        `[@strapi-community/plugin-better-auth-dashboard] Failed to register MCP tools: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
};
