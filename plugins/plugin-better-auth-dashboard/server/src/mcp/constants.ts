import { PLUGIN_ID } from "../utils";

/**
 * Strapi UIDs of the Better Auth content types the MCP tools read from and
 * write to. These content types are generated into the host app by
 * `plugin-better-auth` (they are not shipped by this plugin), so they are
 * referenced here as string literals and cast to a `UID` type at the call site.
 */
export const USER_UID = "plugin::better-auth.user";

/**
 * Permission actions that gate each MCP tool. These are the exact admin RBAC
 * actions this plugin already registers in `register.ts`
 * (`strapi.admin.services.permission.actionProvider.registerMany`), so an admin
 * token needs the same permission to call a tool as an admin user needs to use
 * the matching part of the dashboard UI.
 */
export const ACTION = {
  OVERVIEW_READ: `plugin::${PLUGIN_ID}.overview.read`,
  USER_READ: `plugin::${PLUGIN_ID}.user.read`,
  USER_UPDATE: `plugin::${PLUGIN_ID}.user.update`,
} as const;
