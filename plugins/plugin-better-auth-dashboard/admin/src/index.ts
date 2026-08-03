import type { StrapiApp } from "@strapi/strapi/admin";
import { PluginIcon } from "./components/PluginIcon";
import { PERMISSIONS } from "./constants";
import { PLUGIN_ID } from "./pluginId";
import { addEditViewSidePanel } from "./utils/editViewPanelRegistry";
import { captureApp } from "./utils/strapiApp";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    captureApp(app);

    app.registerPlugin({
      id: PLUGIN_ID,
      name: "Auth Dashboard",
      apis: { addEditViewSidePanel },
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

  bootstrap() {},
};

export default plugin;
