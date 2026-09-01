import type { StrapiApp } from "@strapi/strapi/admin";
import { PluginIcon } from "./components/PluginIcon";
import { PERMISSIONS } from "./constants";
import { getDashConfig, hasPlugin } from "./hooks/useDashConfig";
import { PLUGIN_ID } from "./pluginId";
import { initDash, type ReturnInitDash } from "./utils/dashPages";
import { addEditViewSidePanel } from "./utils/editViewPanelRegistry";
import { captureApp } from "./utils/strapiApp";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    captureApp(app);

    const dash = initDash(app);

    app.registerPlugin({
      id: PLUGIN_ID,
      name: "Auth Dashboard",
      apis: { addEditViewSidePanel, ...dash },
    });

    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: "Auth Dashboard",
      },
      Component: async () => import("./pages/Root"),
      permissions: [
        ...PERMISSIONS.overview,
        ...PERMISSIONS.user,
        ...PERMISSIONS.organization,
      ],
    });
  },

  bootstrap(app) {
    const dash = app.getPlugin(PLUGIN_ID).apis as ReturnInitDash;

    dash.addDashSection({
      id: "general",
      intlLabel: {
        id: `${PLUGIN_ID}.settings.general`,
        defaultMessage: "General",
      },
    });

    dash.addDashLink("general", {
      id: "overview",
      intlLabel: {
        id: `${PLUGIN_ID}.settings.overview`,
        defaultMessage: "Overview",
      },
      to: "/overview",
      Component: () => import("./pages/Overview"),
      permissions: PERMISSIONS.overview,
    });

    dash.addDashLink("general", {
      id: "users",
      intlLabel: {
        id: `${PLUGIN_ID}.settings.users`,
        defaultMessage: "User Management",
      },
      to: "/users",
      Component: () => import("./pages/Users"),
      permissions: PERMISSIONS.user,
    });

    dash.addDashLink("general", {
      id: "organizations",
      intlLabel: {
        id: `${PLUGIN_ID}.settings.organizations`,
        defaultMessage: "Organization Management",
      },
      to: "/organizations",
      Component: () => import("./pages/Organizations"),
      permissions: PERMISSIONS.organization,
      isAvailable: async () => hasPlugin(await getDashConfig(), "organization"),
    });
  },
};

export default plugin;
