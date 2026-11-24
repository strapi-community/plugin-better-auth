export default () => ({
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/auth/dash/:path*",
      handler: "dash-controller.handleDashRequest",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "dash" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "POST",
      path: "/auth/dash/:path*",
      handler: "dash-controller.handleDashRequest",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "dash" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "PUT",
      path: "/auth/dash/:path*",
      handler: "dash-controller.handleDashRequest",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "dash" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "PATCH",
      path: "/auth/dash/:path*",
      handler: "dash-controller.handleDashRequest",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "dash" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "DELETE",
      path: "/auth/dash/:path*",
      handler: "dash-controller.handleDashRequest",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "dash" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "GET",
      path: "/better-auth-dashboard/db",
      handler: "db-controller.list",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "db" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "PUT",
      path: "/better-auth-dashboard/db/:documentId",
      handler: "db-controller.update",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "db" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "DELETE",
      path: "/better-auth-dashboard/db/:documentId",
      handler: "db-controller.delete",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "db" },
          },
        ],
        prefix: "",
      },
    },
    {
      method: "GET",
      path: "/better-auth-dashboard/settings",
      handler: "settings-controller.get",
      config: {
        policies: [
          {
            name: "plugin::better-auth-dashboard.has-permission",
            config: { route: "settings" },
          },
        ],
        prefix: "",
      },
    },
  ],
});
