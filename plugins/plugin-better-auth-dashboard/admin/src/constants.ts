import { PLUGIN_ID } from "./pluginId";

export const PERMISSIONS = {
  overview: [{ action: `plugin::${PLUGIN_ID}.overview.read`, subject: null }],
  user: [
    { action: `plugin::${PLUGIN_ID}.user.create`, subject: null },
    { action: `plugin::${PLUGIN_ID}.user.read`, subject: null },
    { action: `plugin::${PLUGIN_ID}.user.update`, subject: null },
    { action: `plugin::${PLUGIN_ID}.user.delete`, subject: null },
  ],
  organization: [
    { action: `plugin::${PLUGIN_ID}.organization.create`, subject: null },
    { action: `plugin::${PLUGIN_ID}.organization.read`, subject: null },
    { action: `plugin::${PLUGIN_ID}.organization.update`, subject: null },
    { action: `plugin::${PLUGIN_ID}.organization.delete`, subject: null },
  ],
};
