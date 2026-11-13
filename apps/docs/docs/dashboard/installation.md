---
id: installation
title: Installation
sidebar_position: 2
---

# Installation

The additional dashboard plugin requires you to have the Better Auth plugin already installed and configured.

## Packages

```bash
npm install @better-auth/infra @strapi-community/plugin-better-auth-dashboard
# or
yarn add @better-auth/infra @strapi-community/plugin-better-auth-dashboard
# or
pnpm add @better-auth/infra @strapi-community/plugin-better-auth-dashboard
```

## Configuration

:::warning
This plugin only works if you have not changed the `basePath` of Better Auth. It needs to be the default `/api/auth` path.
:::

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

### Config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `email_callback_url` | `string` | — | Absolute URL of your public-facing client app. Used as the callback destination for email verification and password reset links sent from the user detail drawer. Not set by default, which keeps those two actions disabled rather than guessing at a URL. |
| `mcp.enabled` | `boolean` | — | Register Better Auth admin/analytics tools on Strapi's native MCP server. Defaults to `false`. See [MCP server](./mcp.md). |
| `dashApi.enabled` | `boolean` | — | Mount the third-party dash gateway under `/api/better-auth-dashboard/dash/*`. Defaults to `false`. See [Dash API gateway](./dash-api.md). |

## Start Strapi

```bash
pnpm develop
```

The dashboard is now available in the Strapi admin panel.
