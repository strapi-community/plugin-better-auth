import type { Core } from "@strapi/strapi";
import { PLUGIN_ID, ROLE_UID } from "./utils";

const RBAC_ACTIONS = [
  {
    section: "plugins",
    displayName: "Create",
    uid: "roles.create",
    subCategory: "roles",
    pluginName: PLUGIN_ID,
  },
  {
    section: "plugins",
    displayName: "Read",
    uid: "roles.read",
    subCategory: "roles",
    pluginName: PLUGIN_ID,
  },
  {
    section: "plugins",
    displayName: "Update",
    uid: "roles.update",
    subCategory: "roles",
    pluginName: PLUGIN_ID,
  },
  {
    section: "plugins",
    displayName: "Delete",
    uid: "roles.delete",
    subCategory: "roles",
    pluginName: PLUGIN_ID,
  },
];

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const provider = strapi.service("admin::permission").actionProvider;

  await provider.registerMany(RBAC_ACTIONS);
  await manualPermissionOverride(strapi);

  const roleCount = await strapi.documents(ROLE_UID).count({});

  if (roleCount === 0) {
    await strapi.documents(ROLE_UID).create({
      data: {
        name: "Authenticated",
        description: "Default role given to authenticated users.",
        type: "authenticated",
      },
    });

    await strapi.documents(ROLE_UID).create({
      data: {
        name: "Public",
        description: "Default role given to unauthenticated users.",
        type: "public",
      },
    });
  }
};

/**
 * Manually override permissions for API Roles to ensure they are always in sync with Content Manager permissions.
 * @param strapi The Strapi instance
 */
const manualPermissionOverride = async (strapi: Core.Strapi) => {
  const provider = strapi.service("admin::permission").actionProvider;

  for (const action of ["read", "create", "update", "delete"]) {
    const adminString = `plugin::content-manager.explorer.${action}`;
    const aliasString = `plugin::api-permissions.roles.${action}`;

    const adminAction = provider.get(adminString);
    const aliasAction = provider.get(aliasString);

    if (adminAction) {
      if (!adminAction.subjects) adminAction.subjects = [];

      if (!adminAction.subjects.includes(ROLE_UID)) {
        adminAction.subjects.push(ROLE_UID);
      }
    }

    if (aliasAction) {
      if (!aliasAction.aliases) aliasAction.aliases = [];

      const exists = aliasAction.aliases.some(
        ({ actionId, subjects }: { actionId: string; subjects?: string[] }) => {
          return actionId === adminString && subjects?.includes(ROLE_UID);
        },
      );

      if (!exists) {
        aliasAction.aliases.push({
          actionId: adminString,
          subjects: [ROLE_UID],
        });
      }
    }
  }

  try {
    await strapi.service("admin::role")?.resetSuperAdminPermissions?.();
  } catch (err) {
    strapi.log.error(
      "Failed to sync Super Admin permissions for API Roles:",
      err,
    );
  }
};
