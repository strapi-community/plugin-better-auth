---
id: dashboard
title: Dashboard
sidebar_position: 2
---

# Dashboard

A pre-built dashboard can be installed separately that runs inside your Strapi admin panel. See usage information like DAU, manage sessions, disable 2FA and much more.

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

#### Config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `email_callback_url` | `string` | — | Absolute URL of your public-facing client app. Used as the callback destination for email verification and password reset links sent from the user detail drawer. Not set by default, which keeps those two actions disabled rather than guessing at a URL. |

### Start Strapi

```bash
pnpm develop
```

The dashboard is now available in the Strapi admin panel.

## Adaptive UI

The dashboard detects which Better Auth plugins you have enabled and adapts its interface automatically:

| Better Auth plugin | Dashboard effect |
|---|---|
| `admin` (ban users) | Enables the **Ban** action on users and bulk ban in the Users page |
| `organization` | Adds the **Organizations** page to the navigation |
| `twoFactor` | Shows 2FA enrollment status in the user detail drawer |
| `emailVerification` | Shows email verification status and exposes a resend action |

---

## Edit view panel API

The dashboard exposes an API that lets other Strapi plugins inject custom sidebar panels into the **user detail drawer** and the **organization detail view**. Use it to display extra context — subscriptions, audit logs, feature flags, or anything else — right alongside the built-in fields.

### Registering a panel

Call `addEditViewSidePanel` in the `bootstrap` function of your Strapi admin plugin:

```typescript title="my-plugin/admin/src/index.ts"
import MyPanel from "./components/MyPanel";

export default {
  register() {},

  bootstrap(app: { getPlugin: (id: string) => { apis: Record<string, unknown> } }) {
    const dashboardPlugin = app.getPlugin("better-auth-dashboard");
    if (!dashboardPlugin) return; // dashboard not installed

    const { addEditViewSidePanel } = dashboardPlugin.apis as {
      addEditViewSidePanel: (config: EditViewPanelConfig) => void;
    };

    addEditViewSidePanel({
      id: "my-plugin.subscription-info",
      title: "Subscription",
      model: "plugin::better-auth.user",
      Component: MyPanel,
    });
  },
};
```

### Config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier for the panel. Use `"my-plugin.panel-name"` to avoid collisions. |
| `title` | `string` | ✅ | Heading rendered above the panel content. |
| `model` | `string \| string[]` | — | Restrict the panel to one or more content-type UIDs. Omit to show the panel in every edit view. |
| `Component` | `React.ComponentType<EditViewPanelProps>` | ✅ | The React component to render inside the panel. |

#### `EditViewPanelProps`

Your component receives these props:

| Prop | Type | Description |
|---|---|---|
| `model` | `string` | Content-type UID of the open record (e.g. `"plugin::better-auth.user"`). |
| `documentId` | `string \| undefined` | Strapi `documentId` of the record. Use this to fetch related data. |
| `document` | `Record<string, unknown> \| undefined` | Full Strapi document object. Contains all fields loaded by the detail view. |

#### Available `model` values

| Model UID | Edit view |
|---|---|
| `plugin::better-auth.user` | User detail drawer |
| `plugin::better-auth.organization` | Organization detail view |

### Example component

```typescript title="my-plugin/admin/src/components/MyPanel.tsx"
import { useQuery } from "react-query";

interface Props {
  model: string;
  documentId?: string;
  document?: Record<string, unknown>;
}

export default function SubscriptionPanel({ documentId }: Props) {
  const { data, isLoading } = useQuery(
    ["subscription", documentId],
    () => fetch(`/api/subscriptions?userId=${documentId}`).then((r) => r.json()),
    { enabled: !!documentId },
  );

  if (isLoading) return <p>Loading…</p>;
  if (!data) return null;

  return <p>Plan: {data.plan}</p>;
}
```

:::tip
`documentId` is the Strapi document identifier, not the Better Auth `userId`. If you need the Better Auth user ID, read it from the `document` prop (e.g. `document?.id`).
:::
