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

  // Register permission actions, skipping any already registered. Strapi's admin
  // action registry can retain actions across a reload within the same process
  // (integration tests that reboot Strapi, `strapi develop` watch mode), and
  // `registerMany` throws on a duplicate key — which would crash the boot.
  const actionProvider = strapi.admin.services.permission.actionProvider as {
    has: (actionId: string) => boolean;
    registerMany: (actions: typeof actionsToRegister) => unknown;
  };
  const newActions = actionsToRegister.filter(
    (action) =>
      !actionProvider.has(`plugin::${action.pluginName}.${action.uid}`),
  );
  if (newActions.length > 0) {
    actionProvider.registerMany(newActions);
  }

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
