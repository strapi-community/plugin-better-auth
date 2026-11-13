---
id: screen-api
title: Dashboard screen API
sidebar_position: 5
---

# Dashboard screen API

Other Strapi admin plugins can add their own sections and screens to the Better Auth dashboard. The dashboard plugin exposes three APIs for this purpose:

- `addDashSection` creates a navigation section.
- `addDashLink` registers a lazy route and adds its link to a section.
- `getDashLinks` returns the current section and link registry.

Call these APIs from your admin plugin's `bootstrap` function. Register routes synchronously during bootstrap; use `isAvailable` when visibility depends on data that must be loaded asynchronously.

## Add a screen from another plugin

```tsx title="my-plugin/admin/src/index.ts"
import type { StrapiApp } from "@strapi/strapi/admin";

type DashboardApi = {
  addDashSection: (section: {
    id: string;
    intlLabel: { id: string; defaultMessage: string };
    priority?: number;
  }) => void;
  addDashLink: (
    sectionId: string,
    link: {
      id: string;
      intlLabel: { id: string; defaultMessage: string };
      to: string;
      Component: () => Promise<unknown>;
      permissions?: Array<{ action: string; subject?: string | null }>;
      isAvailable?: () => boolean | Promise<boolean>;
    },
  ) => void;
};

export default {
  bootstrap(app: StrapiApp) {
    const dashboardPlugin = app.getPlugin("better-auth-dashboard");
    if (!dashboardPlugin) return;

    const dashboard = dashboardPlugin.apis as DashboardApi;

    dashboard.addDashSection({
      id: "my-plugin",
      intlLabel: {
        id: "my-plugin.dashboard.section",
        defaultMessage: "My plugin",
      },
      priority: 20,
    });

    dashboard.addDashLink("my-plugin", {
      id: "my-plugin.audit-log",
      intlLabel: {
        id: "my-plugin.dashboard.audit-log",
        defaultMessage: "Audit log",
      },
      to: "/audit-log",
      Component: () => import("./pages/AuditLog"),
      permissions: [
        {
          action: "plugin::my-plugin.audit-log.read",
          subject: null,
        },
      ],
      isAvailable: async () => {
        const response = await fetch("/my-plugin/features");
        if (!response.ok) return false;

        const features = await response.json();
        return features.auditLog === true;
      },
    });
  },
};
```

The route above is available at `/admin/plugins/better-auth-dashboard/audit-log`. The page module is loaded only when the route is visited.

:::note
Use namespaced section and link IDs, such as `"my-plugin.audit-log"`, to avoid collisions with built-in screens and other plugins.
:::

## `addDashSection(section)`

Creates a section in the dashboard navigation. Add the section before passing its ID to `addDashLink`.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique section identifier. Namespace IDs owned by another plugin. |
| `intlLabel` | `{ id: string; defaultMessage: string }` | ✅ | Translatable navigation label. |
| `priority` | `number` | — | Sort order. Lower values appear first; the default is `0`. Sections with the same priority are sorted by ID. |

Registering a section with an existing ID leaves the original section unchanged and logs a warning.

## `addDashLink(section, link)`

Registers a child route and adds its navigation link. `section` can be an existing section ID or a complete section object. Prefer calling `addDashSection` separately when multiple plugins may contribute links to the same section.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique link identifier. Namespace IDs owned by another plugin. |
| `intlLabel` | `{ id: string; defaultMessage: string }` | ✅ | Translatable navigation label. |
| `to` | `string` | ✅ | Path relative to `/admin/plugins/better-auth-dashboard`. Leading and trailing slashes are optional. |
| `Component` | `() => Promise<module>` | ✅ | Lazy import for the screen component. The module may use either a default export or be the component itself. |
| `permissions` | `Permission[]` | — | Strapi admin permissions. The link is hidden unless the administrator has at least one supplied permission, and direct route access is protected. An omitted or empty array allows every signed-in administrator. |
| `isAvailable` | `() => boolean \| Promise<boolean>` | — | Runtime availability predicate. Defaults to `true`. See [Conditional screens](#conditional-screens). |

The screen renders inside the dashboard layout through React Router's `<Outlet />`. It does not receive outlet context, so it should own its data fetching and state.

## Conditional screens

Use `isAvailable` for feature flags, license checks, server capabilities, or optional dependencies:

```tsx
dashboard.addDashLink("my-plugin", {
  id: "my-plugin.reports",
  intlLabel: {
    id: "my-plugin.dashboard.reports",
    defaultMessage: "Reports",
  },
  to: "/reports",
  Component: () => import("./pages/Reports"),
  isAvailable: async () => {
    const response = await fetch("/my-plugin/capabilities");
    return response.ok && (await response.json()).reportsEnabled === true;
  },
});
```

Availability is evaluated outside Strapi's synchronous bootstrap lifecycle. Its result is:

- cached for five minutes with React Query;
- combined with the link's permission check;
- used both by the navigation and the direct-route guard;
- treated as `false` if the predicate throws or rejects.

The route itself is always registered synchronously, but its component bundle remains lazy. This makes asynchronous predicates reliable without delaying or mutating Strapi's router after bootstrap.

For configuration already available synchronously during bootstrap, you can instead conditionally call `addDashLink`:

```tsx
if (pluginConfig.reportsEnabled) {
  dashboard.addDashLink("my-plugin", reportsLink);
}
```

## `getDashLinks()`

Returns the current in-memory dashboard registry keyed by section ID:

```tsx
const sections = dashboard.getDashLinks();
const links = sections["my-plugin"]?.links ?? [];
```

Each section contains its registration properties plus a `links` array. This API is useful for inspecting registrations made earlier in bootstrap, detecting whether a section exists, or integrating developer tooling.

:::warning
`getDashLinks` returns the live registry, not a snapshot. Treat it as read-only and use `addDashSection` and `addDashLink` for changes. Its contents reflect bootstrap order, so do not assume another plugin has registered its links unless that plugin has already bootstrapped.
:::
