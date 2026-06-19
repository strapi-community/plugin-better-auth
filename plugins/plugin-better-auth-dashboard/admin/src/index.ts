import { PluginIcon } from "./components/PluginIcon";
import { PLUGIN_ID } from "./pluginId";
import { addEditViewSidePanel } from "./utils/editViewPanelRegistry";
import { captureApp } from "./utils/strapiApp";

export default {
  register(app: {
    addMenuLink: (config: {
      to: string;
      icon: React.ComponentType;
      intlLabel: { id: string; defaultMessage: string };
      Component: () => Promise<{ default: React.ComponentType }>;
    }) => void;
    router: {
      addRoute: (config: {
        path: string;
        Component: () => Promise<{ default: React.ComponentType }>;
      }) => void;
    };
    // biome-ignore lint/suspicious/noExplicitAny: Strapi app bridge type
    library: any;
    registerPlugin: (config: {
      id: string;
      name: string;
      // biome-ignore lint/suspicious/noExplicitAny: plugin API shape is open-ended
      apis: Record<string, any>;
    }) => void;
  }) {
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
    });

    app.router.addRoute({
      path: `plugins/${PLUGIN_ID}/*`,
      Component: async () => import("./pages/Root"),
    });
  },

  bootstrap() {},
};
