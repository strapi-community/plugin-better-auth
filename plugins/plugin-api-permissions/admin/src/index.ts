import type { StrapiApp } from "@strapi/strapi/admin";

const pluginId = "api-permissions";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.addSettingsLink(
      {
        id: pluginId,
        intlLabel: {
          id: `${pluginId}.Settings.section-label`,
          defaultMessage: "API Permissions",
        },
      },
      {
        id: "roles",
        intlLabel: {
          id: "global.roles",
          defaultMessage: "Roles",
        },
        to: `${pluginId}/roles`,
        Component: () => import("./pages/Roles"),
        permissions: [
          { action: "plugin::api-permissions.roles.read", subject: null },
          { action: "plugin::api-permissions.roles.create", subject: null },
        ],
      },
    );

    app.registerPlugin({
      id: pluginId,
      name: "API Permissions",
    });
  },
};

export default plugin;
