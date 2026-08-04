/**
 * Transform utilities for permissions between layout, form state, and API format.
 *
 * API format (role service): { "api::article": { controllers: { article: { create: { enabled: true } } } } }
 * Action strings stored in DB: "api::article.article.create" | "plugin::upload.upload.find"
 * Form state: { collectionTypes: { [ctUID]: { [actionId]: { properties: { enabled } } } }, ... }
 */

export type PermissionsLayout = {
  collectionTypes: {
    actions: Array<{ actionId: string; label: string; subjects: string[] }>;
    subjects: Array<{ uid: string; label: string }>;
  };
  singleTypes: {
    actions: Array<{ actionId: string; label: string; subjects: string[] }>;
    subjects: Array<{ uid: string; label: string }>;
  };
  plugins: Array<{
    action: string;
    displayName: string;
    plugin: string;
    subCategory: string;
  }>;
  settings: Array<unknown>;
};

export type PermissionsFormState = {
  collectionTypes: Record<
    string,
    Record<string, { properties: { enabled: boolean } }>
  >;
  singleTypes: Record<
    string,
    Record<string, { properties: { enabled: boolean } }>
  >;
  plugins: Record<
    string,
    Record<string, Record<string, { properties: { enabled: boolean } }>>
  >;
  settings: Record<string, unknown>;
};

export type ApiPermissionsFormat = Record<
  string,
  { controllers: Record<string, Record<string, { enabled: boolean }>> }
>;

export type PermissionEntry = {
  id: number;
  documentId: string;
  action: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};

/**
 * Transform array of permission entries to a matrix format for easier processing.
 * @param permissions Array of permission entries from the API.
 * @returns Matrix format of permissions.
 */
export function permissionsToMatrix(
  permissions: PermissionEntry[],
): ApiPermissionsFormat {
  const matrix: ApiPermissionsFormat = {};

  for (const entry of permissions) {
    if (!entry?.action) continue;

    // Splits "api::article.article.find" into ["api::article", "article", "find"]
    const parts = entry.action.split(".");
    if (parts.length < 3) continue;

    const actionName = parts.pop()!;
    const controllerName = parts.pop()!;
    const apiKey = parts.join(".");

    matrix[apiKey] ??= { controllers: {} };
    matrix[apiKey].controllers[controllerName] ??= {};
    matrix[apiKey].controllers[controllerName][actionName] = { enabled: true };
  }

  return matrix;
}

/**
 * Create empty form state from layout.
 */
export function createEmptyFormState(
  layout: PermissionsLayout,
): PermissionsFormState {
  const createContentForm = (
    subjects: PermissionsLayout["collectionTypes"]["subjects"],
    actions: PermissionsLayout["collectionTypes"]["actions"],
  ) => {
    const form: PermissionsFormState["collectionTypes"] = {};
    for (const subject of subjects) {
      form[subject.uid] = {};
      for (const action of actions) {
        if (action.subjects.includes(subject.uid)) {
          form[subject.uid][action.actionId] = {
            properties: { enabled: false },
          };
        }
      }
    }
    return form;
  };

  const pluginsForm: PermissionsFormState["plugins"] = {};
  const pluginGroups = new Map<string, Map<string, string[]>>();
  for (const p of layout.plugins) {
    const pluginName = p.plugin;
    const subCategory = p.subCategory;
    const actionName = p.action.split(".").pop() ?? p.action;
    if (!pluginGroups.has(pluginName)) {
      pluginGroups.set(pluginName, new Map());
    }
    const subMap = pluginGroups.get(pluginName)!;
    const actions = subMap.get(subCategory) ?? [];
    if (!actions.includes(actionName)) {
      actions.push(actionName);
    }
    subMap.set(subCategory, actions);
  }
  for (const [plugin, subMap] of pluginGroups) {
    pluginsForm[plugin] = {};
    for (const [subCategory, actions] of subMap) {
      pluginsForm[plugin][subCategory] = {};
      for (const action of actions) {
        pluginsForm[plugin][subCategory][action] = {
          properties: { enabled: false },
        };
      }
    }
  }

  return {
    collectionTypes: createContentForm(
      layout.collectionTypes.subjects,
      layout.collectionTypes.actions,
    ),
    singleTypes: createContentForm(
      layout.singleTypes.subjects,
      layout.singleTypes.actions,
    ),
    plugins: pluginsForm,
    settings: {},
  };
}

/**
 * Transform API format (from role.permissions) to form state.
 */
export function apiToFormState(
  api: PermissionEntry[],
  layout: PermissionsLayout,
): PermissionsFormState {
  const form = createEmptyFormState(layout);
  const matrix = permissionsToMatrix(api);

  const collectionUids = new Set(
    layout.collectionTypes.subjects.map((s) => s.uid),
  );
  const singleUids = new Set(layout.singleTypes.subjects.map((s) => s.uid));

  for (const [typeKey, typeData] of Object.entries(matrix)) {
    if (!typeData?.controllers) continue;

    for (const [controllerName, controllerData] of Object.entries(
      typeData.controllers,
    )) {
      for (const [actionName, actionData] of Object.entries(controllerData)) {
        if (!actionData?.enabled) continue;

        if (typeKey.startsWith("api::")) {
          const ctUid = `${typeKey}.${controllerName}`;
          if (
            collectionUids.has(ctUid) &&
            form.collectionTypes[ctUid]?.[actionName]
          ) {
            form.collectionTypes[ctUid][actionName].properties.enabled = true;
          }
          if (singleUids.has(ctUid) && form.singleTypes[ctUid]?.[actionName]) {
            form.singleTypes[ctUid][actionName].properties.enabled = true;
          }
        } else if (typeKey.startsWith("plugin::")) {
          const pluginName = typeKey.replace("plugin::", "");
          if (form.plugins[pluginName]?.[controllerName]?.[actionName]) {
            form.plugins[pluginName][controllerName][
              actionName
            ].properties.enabled = true;
          }
        }
      }
    }
  }

  return form;
}

/**
 * Transform form state to API format for saving.
 */
export function formStateToApi(
  form: PermissionsFormState,
): ApiPermissionsFormat {
  const api: ApiPermissionsFormat = {};

  for (const [ctUid, actions] of Object.entries(form.collectionTypes)) {
    if (!actions) continue;
    if (!ctUid.startsWith("api::")) continue;
    const afterApi = ctUid.replace("api::", "");
    const parts = afterApi.split(".");
    const apiKey = `api::${parts[0] ?? ""}`;
    const controllerName = parts[1] ?? parts[0] ?? "";
    if (!api[apiKey]) api[apiKey] = { controllers: {} };
    if (!api[apiKey].controllers[controllerName])
      api[apiKey].controllers[controllerName] = {};
    for (const [actionId, data] of Object.entries(actions)) {
      if (data?.properties?.enabled) {
        api[apiKey].controllers[controllerName][actionId] = { enabled: true };
      }
    }
  }

  for (const [ctUid, actions] of Object.entries(form.singleTypes)) {
    if (!actions) continue;
    if (!ctUid.startsWith("api::")) continue;
    const afterApi = ctUid.replace("api::", "");
    const parts = afterApi.split(".");
    const apiKey = `api::${parts[0] ?? ""}`;
    const controllerName = parts[1] ?? parts[0] ?? "";
    if (!api[apiKey]) api[apiKey] = { controllers: {} };
    if (!api[apiKey].controllers[controllerName])
      api[apiKey].controllers[controllerName] = {};
    for (const [actionId, data] of Object.entries(actions)) {
      if (data?.properties?.enabled) {
        api[apiKey].controllers[controllerName][actionId] = { enabled: true };
      }
    }
  }

  for (const [pluginName, subCategories] of Object.entries(form.plugins)) {
    if (!subCategories) continue;
    const pluginKey = `plugin::${pluginName}`;
    if (!api[pluginKey]) api[pluginKey] = { controllers: {} };
    for (const [subCategory, actions] of Object.entries(subCategories)) {
      if (!api[pluginKey].controllers[subCategory])
        api[pluginKey].controllers[subCategory] = {};
      for (const [actionId, data] of Object.entries(actions)) {
        if (data?.properties?.enabled) {
          api[pluginKey].controllers[subCategory][actionId] = { enabled: true };
        }
      }
    }
  }

  return api;
}
