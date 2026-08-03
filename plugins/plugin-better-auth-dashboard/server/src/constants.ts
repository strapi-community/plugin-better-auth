import { PLUGIN_ID } from "./utils";

export const ACTIONS = {
  overview: [
    {
      section: "plugins",
      subCategory: "overview",
      displayName: "Read",
      pluginName: PLUGIN_ID,
      uid: "overview.read",
    },
  ],
  user: [
    {
      section: "plugins",
      subCategory: "user",
      displayName: "Create",
      pluginName: PLUGIN_ID,
      uid: "user.create",
    },
    {
      section: "plugins",
      subCategory: "user",
      displayName: "Read",
      pluginName: PLUGIN_ID,
      uid: "user.read",
    },
    {
      section: "plugins",
      subCategory: "user",
      displayName: "Update",
      pluginName: PLUGIN_ID,
      uid: "user.update",
    },
    {
      section: "plugins",
      subCategory: "user",
      displayName: "Delete",
      pluginName: PLUGIN_ID,
      uid: "user.delete",
    },
  ],
  organization: [
    {
      section: "plugins",
      subCategory: "organization",
      displayName: "Create",
      pluginName: PLUGIN_ID,
      uid: "organization.create",
    },
    {
      section: "plugins",
      subCategory: "organization",
      displayName: "Read",
      pluginName: PLUGIN_ID,
      uid: "organization.read",
    },
    {
      section: "plugins",
      subCategory: "organization",
      displayName: "Update",
      pluginName: PLUGIN_ID,
      uid: "organization.update",
    },
    {
      section: "plugins",
      subCategory: "organization",
      displayName: "Delete",
      pluginName: PLUGIN_ID,
      uid: "organization.delete",
    },
  ],
};
