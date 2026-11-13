import type { Core } from "@strapi/types";
import type { Config } from "./config";
import { ACTIONS } from "./constants";
import { registerMcpTools } from "./mcp";
import contentApiRoutes from "./routes/content-api";
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

  const config = strapi.config.get<Config>(`plugin::${PLUGIN_ID}`, {});

  // Opt-in: mount the third-party dash gateway at /api/better-auth-dashboard/dash/*
  // (the same way plugin-better-auth mounts /api/auth/*). Registering only when
  // enabled means the route simply doesn't exist when the feature is off.
  if (config.dashApi?.enabled) {
    strapi.server.routes(contentApiRoutes);
  }

  // Opt-in: register Better Auth MCP tools on Strapi's native MCP server.
  // Must happen in register() — the MCP server starts during bootstrap.
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
