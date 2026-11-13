# Strapi + Better Auth Dashboard

An admin panel dashboard plugin for [Strapi](https://strapi.io) that provides user management, session monitoring, and analytics for [Better Auth](https://better-auth.com) authentication.

## Features

- Overview page with user metrics, growth charts, and cohort retention analysis
- User management: search, create, edit, delete, and ban users
- Session management: view and revoke active sessions per user from the user detail drawer
- Organization management (when the Better Auth organization plugin is enabled)
- Real-time active user tracking (DAU / WAU / MAU)
- Automatic feature detection — ban, 2FA, email verification, and organization UI adapts to your Better Auth config

## Installation

The additional dashboard plugin requires you to have the Better Auth plugin already installed and configured.

### Packages

```bash
npm install @better-auth/infra @strapi-community/plugin-better-auth-dashboard
# or
yarn add @better-auth/infra @strapi-community/plugin-better-auth-dashboard
# or
pnpm add @better-auth/infra @strapi-community/plugin-better-auth-dashboard
```

### Configuration

> [!CAUTION]
> This plugin only works if you have not changed the `basePath` of Better Auth. It needs to be the default `/api/auth` path.

In order to run this plugin you need to configure the `dash()` and `jwt()` plugins from Better Auth.

```typescript title="src/lib/auth.ts"
import { dash } from "@better-auth/infra";
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
  plugins: [
    jwt(),
    dash({
      apiUrl: process.env.STRAPI_URL || "http://localhost:1337",
      apiKey:
        process.env.BETTER_AUTH_DASHBOARD_SECRET ||
        "strapi-internal-dashboard-key",
    }),
  ],
  advanced: {
    database: {
      generateId: 'serial',
    },
  },
  emailAndPassword: {
    enabled: true,
  },
});
```

To enable the "Send verification email" and "Send password reset" actions in the user detail drawer, configure the dashboard plugin itself in `config/plugins.js`/`.ts`:

```typescript title="config/plugins.ts"
export default {
  "better-auth-dashboard": {
    config: {
      // Absolute URL of your public-facing client app. Used as the
      // callback destination for email verification / password reset
      // links sent from the dashboard. Unset by default — the two
      // actions above stay disabled until this is configured, rather
      // than guessing at a URL (e.g. the admin panel's own origin).
      email_callback_url: process.env.BETTER_AUTH_DASHBOARD_CALLBACK_URL,
    },
  },
};
```

### Start Strapi

```bash
pnpm develop
```

The dashboard is now available in the Strapi admin panel.

## MCP server integration

This plugin can expose Better Auth **admin and analytics tools** on Strapi's
native [MCP server](https://docs.strapi.io/cms/features/strapi-mcp-server), so AI
clients can list, inspect, update and ban users and read sign-up analytics
through `POST /mcp`. It requires Strapi `>= 5.47`.

The integration is **opt-in** and gated by two switches:

```typescript title="config/server.ts"
export default ({ env }) => ({
  // ...existing config
  mcp: { enabled: true }, // Strapi's own MCP server (serves POST /mcp)
});
```

```typescript title="config/plugins.ts"
export default {
  "better-auth-dashboard": {
    config: {
      mcp: { enabled: true }, // register this plugin's Better Auth tools
    },
  },
};
```

> [!NOTE]
> On Strapi versions below 5.47 (no MCP server) the plugin simply skips tool
> registration — enabling the flag is harmless.

### Authentication & permissions

MCP clients authenticate with an **admin API token** (created in
_Settings → API Tokens_) sent as `Authorization: Bearer <token>`. Every tool is
gated by the **same permissions as the dashboard UI** — the token's admin role
must hold the relevant `Better Auth Dashboard` permissions:

| Permission | Tools it unlocks |
| ---------- | ---------------- |
| `user.read` | `better_auth_list_users`, `better_auth_get_user` |
| `user.update` | `better_auth_update_user`, `better_auth_ban_user`, `better_auth_unban_user`, `better_auth_set_user_role` |
| `overview.read` | `better_auth_user_stats`, `better_auth_signups_over_time` |

### Available tools

| Tool | Description |
| ---- | ----------- |
| `better_auth_list_users` | List/search/paginate users, filter by banned status |
| `better_auth_get_user` | Fetch a single user by `documentId` or `email` |
| `better_auth_update_user` | Update a user's `name` / `email` / `emailVerified` |
| `better_auth_ban_user` | Ban a user and revoke their active sessions¹ |
| `better_auth_unban_user` | Lift a user's ban¹ |
| `better_auth_set_user_role` | Set a user's Better Auth admin role¹ |
| `better_auth_user_stats` | Totals: users, verified, banned, active sessions, recent sign-ups |
| `better_auth_signups_over_time` | Sign-up counts bucketed by day/week/month over a range |

¹ Registered only when the Better Auth [`admin`](https://www.better-auth.com/docs/plugins/admin)
plugin is configured (the `banned` / `role` fields it adds must exist on the
`user` schema).

## Pages

| Tab | Description |
| --- | ----------- |
| **Overview** | User metrics, growth charts, cohort retention, active user rings |
| **Users** | Searchable user table with create, edit, delete, ban, and session revoke per user |
| **Organizations** | Organization list with member management (requires Better Auth `organization` plugin) |

## Extending the dashboard

Other Strapi admin plugins can add sections and lazy-loaded screens through the dashboard plugin's admin API. Call the API during your plugin's `bootstrap` lifecycle:

```typescript
export default {
  bootstrap(app) {
    const plugin = app.getPlugin("better-auth-dashboard");
    if (!plugin) return;

    const dashboard = plugin.apis;

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
      permissions: [],
      isAvailable: async () => checkAuditLogAvailability(),
    });
  },
};
```

Available APIs:

| API | Description |
| --- | --- |
| `addDashSection(section)` | Creates a navigation section. `priority` controls section order. |
| `addDashLink(section, link)` | Registers a lazy route and adds its link to a section. Supports Strapi admin `permissions` and sync or async `isAvailable`. |
| `getDashLinks()` | Returns the live section and link registry. Treat the result as read-only. |

`isAvailable` defaults to `true`. Its result is cached for five minutes, combined with permission checks, and applied to both navigation and direct route access. Errors are treated as unavailable.

See the [Dashboard documentation](https://strapi-community.github.io/plugin-better-auth/docs/better-auth/dashboard#dashboard-screen-api) for the complete API reference and extension guidance.

## Requirements

- `@strapi-community/plugin-better-auth` installed and configured
- Strapi v5.45.0+
- Better Auth >= 1.4.0

## Resources

- [Documentation](https://strapi-community.github.io/plugin-better-auth/docs/better-auth/dashboard)
- [Better Auth Documentation](https://better-auth.com)
- [Strapi Documentation](https://docs.strapi.io)

## Authors

- [Boaz Poolman](https://github.com/boazpoolman)

## License

See the [LICENSE](./LICENSE.md) file for licensing information.
