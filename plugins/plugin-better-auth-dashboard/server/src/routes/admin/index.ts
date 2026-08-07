export default () => ({
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/auth/:path*",
      handler: "auth-controller.handleAuthRequest",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "POST",
      path: "/auth/:path*",
      handler: "auth-controller.handleAuthRequest",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "PUT",
      path: "/auth/:path*",
      handler: "auth-controller.handleAuthRequest",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "PATCH",
      path: "/auth/:path*",
      handler: "auth-controller.handleAuthRequest",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "DELETE",
      path: "/auth/:path*",
      handler: "auth-controller.handleAuthRequest",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "GET",
      path: "/better-auth-dashboard/db",
      handler: "db-controller.list",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "PUT",
      path: "/better-auth-dashboard/db/:documentId",
      handler: "db-controller.update",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
    {
      method: "GET",
      path: "/better-auth-dashboard/settings",
      handler: "settings-controller.get",
      config: {
        policies: ["has-permission"],
        prefix: "",
      },
    },
  ],
});
