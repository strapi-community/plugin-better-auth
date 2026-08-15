import type { Core } from "@strapi/strapi";
import { PLUGIN_ID } from "../utils";

// Actions that don't apply to single types (no concept of creating or fetching one-by-id)
const SINGLE_TYPE_EXCLUDED_ACTIONS = new Set(["create", "findOne"]);

const actionLabels: Record<string, string> = {
  create: "Create",
  find: "Find",
  findOne: "Find One",
  update: "Update",
  delete: "Delete",
};

const isSingleType = (ct: { kind?: string }) => ct?.kind === "singleType";

type ContentPermission = {
  actions: Array<{ actionId: string; label: string; subjects: string[] }>;
  subjects: Array<{ uid: string; label: string }>;
};
type PluginPermission = {
  action: string;
  displayName: string;
  plugin: string;
  subCategory: string;
};

function buildPermissionsLayout(strapi: Core.Strapi): {
  collectionTypes: ContentPermission;
  singleTypes: ContentPermission;
  plugins: PluginPermission[];
  settings: PluginPermission[];
} {
  const collectionSubjects: Array<{ uid: string; label: string }> = [];
  const singleSubjects: Array<{ uid: string; label: string }> = [];
  const collectionActions = new Map<
    string,
    { actionId: string; label: string; subjects: string[] }
  >();
  const singleActions = new Map<
    string,
    { actionId: string; label: string; subjects: string[] }
  >();
  const plugins: PluginPermission[] = [];

  const actionsMap = strapi.contentAPI.permissions.getActionsMap();

  for (const [uid, contentType] of Object.entries(strapi.contentTypes ?? {})) {
    const ct = contentType as {
      uid?: string;
      info?: { displayName?: string };
      kind?: string;
    };
    if (!uid.startsWith("api::")) continue;

    const label = ct.info?.displayName ?? uid.split(".").pop() ?? uid;
    const isSingle = isSingleType(ct);
    const parts = uid.split(".");
    const apiKey = `api::${parts[0]?.replace("api::", "") ?? ""}`;
    const controllerName = parts[1] ?? parts[0] ?? "";

    const apiEntry = actionsMap[apiKey];
    const controllerActions = apiEntry?.controllers?.[controllerName] ?? [];

    const allowedActions = isSingle
      ? (controllerActions as string[]).filter(
          (a) => !SINGLE_TYPE_EXCLUDED_ACTIONS.has(a),
        )
      : (controllerActions as string[]);

    if (allowedActions.length === 0) continue;

    if (isSingle) {
      singleSubjects.push({ uid, label });
      for (const actionId of allowedActions) {
        if (!singleActions.has(actionId)) {
          singleActions.set(actionId, {
            actionId,
            label: actionLabels[actionId] ?? actionId,
            subjects: [],
          });
        }
        singleActions.get(actionId)!.subjects.push(uid);
      }
    } else {
      collectionSubjects.push({ uid, label });
      for (const actionId of allowedActions) {
        if (!collectionActions.has(actionId)) {
          collectionActions.set(actionId, {
            actionId,
            label: actionLabels[actionId] ?? actionId,
            subjects: [],
          });
        }
        collectionActions.get(actionId)!.subjects.push(uid);
      }
    }
  }

  for (const [pluginKey, value] of Object.entries(actionsMap)) {
    if (!pluginKey.startsWith("plugin::") || pluginKey.includes(PLUGIN_ID))
      continue;
    const pluginName = pluginKey.replace("plugin::", "");
    const { controllers } = value ?? {};
    for (const [subCategory, actions] of Object.entries(controllers ?? {})) {
      for (const actionName of actions ?? []) {
        plugins.push({
          action: `${pluginKey}.${subCategory}.${actionName}`,
          displayName: `${subCategory} - ${actionName}`,
          plugin: pluginName,
          subCategory,
        });
      }
    }
  }

  return {
    collectionTypes: {
      actions: Array.from(collectionActions.values()),
      subjects: collectionSubjects,
    },
    singleTypes: {
      actions: Array.from(singleActions.values()),
      subjects: singleSubjects,
    },
    plugins,
    settings: [],
  };
}

interface PermissionProperty {
  properties: {
    enabled: boolean;
  };
}

type PermissionsPayload = {
  collectionTypes?: Record<string, Record<string, PermissionProperty>>;
  singleTypes?: Record<string, Record<string, PermissionProperty>>;
  plugins?: Record<string, Record<string, Record<string, PermissionProperty>>>;
  settings?: Record<string, Record<string, Record<string, PermissionProperty>>>;
};

/**
 * Extracts enabled actions from the permissions payload.
 * @param payload The permissions payload containing collection types, single types, plugins, and settings.
 * @returns An array of strings representing the enabled actions in the format:
 *          - For collection and single types: "api::\<uid\>.\<action\>"
 *          - For plugins: "plugin::\<plugin-name\>.\<controller\>.\<action\>"
 *          - For settings: "plugin::\<setting-name\>.\<controller\>.\<action\>"
 */
function extractActionsFromPermissions(payload: PermissionsPayload): string[] {
  const actions: Set<string> = new Set();

  const contentTypes = { ...payload.collectionTypes, ...payload.singleTypes };
  for (const [uid, controllerActions] of Object.entries(contentTypes)) {
    for (const [actionName, config] of Object.entries(controllerActions)) {
      if (config?.properties?.enabled) {
        actions.add(`${uid}.${actionName}`);
      }
    }
  }

  if (payload.plugins) {
    for (const [pluginName, controllers] of Object.entries(payload.plugins)) {
      for (const [controllerName, controllerActions] of Object.entries(
        controllers,
      )) {
        for (const [actionName, config] of Object.entries(controllerActions)) {
          if (config?.properties?.enabled) {
            actions.add(
              `plugin::${pluginName}.${controllerName}.${actionName}`,
            );
          }
        }
      }
    }
  }

  if (payload.settings) {
    for (const [settingName, controllers] of Object.entries(payload.settings)) {
      for (const [controllerName, controllerActions] of Object.entries(
        controllers,
      )) {
        for (const [actionName, config] of Object.entries(controllerActions)) {
          if (config?.properties?.enabled) {
            actions.add(
              `plugin::${settingName}.${controllerName}.${actionName}`,
            );
          }
        }
      }
    }
  }

  return Array.from(actions);
}

export async function connectRolesToPermissions(
  roleID: string,
  actionList: string[] = [],
  strapi: Core.Strapi,
) {
  return strapi.db.transaction(async () => {
    const existing = await strapi
      .documents("plugin::api-permissions.permission")
      .findMany({
        populate: ["role"],
        filters: {
          action: { $in: actionList },
          $or: [
            { role: { documentId: { $eq: roleID } } },
            { role: { documentId: { $null: true } } },
          ],
        },
        fields: ["documentId", "action"],
      });

    const permissionMap = new Map(
      existing.map((p) => [p.action, p.documentId]),
    );

    const targetDocumentIds = await Promise.all(
      actionList.map(async (action) => {
        if (permissionMap.has(action)) return permissionMap.get(action)!;

        const newPermission = await strapi
          .documents("plugin::api-permissions.permission")
          .create({ data: { action } });

        return newPermission.documentId;
      }),
    );

    await strapi.documents("plugin::api-permissions.role").update({
      documentId: roleID,
      data: { permissions: { set: targetDocumentIds } },
    });

    await strapi.db.query("plugin::api-permissions.permission").deleteMany({
      where: { role: { $null: true } },
    });
  });
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  return {
    getPermissionsLayout() {
      return buildPermissionsLayout(strapi);
    },
    extractActionsFromPermissions,
    connectRolesToPermissions(id: string, actions: string[]) {
      return connectRolesToPermissions(id, actions, strapi);
    },
  };
};
