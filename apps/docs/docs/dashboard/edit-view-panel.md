---
id: edit-view-panel
title: Edit view panel API
sidebar_position: 6
---

# Edit view panel API

The dashboard exposes an API that lets other Strapi plugins inject custom sidebar panels into the **user detail drawer** and the **organization detail view**. Use it to display extra context — subscriptions, audit logs, feature flags, or anything else — right alongside the built-in fields.

## Registering a panel

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

## Config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier for the panel. Use `"my-plugin.panel-name"` to avoid collisions. |
| `title` | `string` | ✅ | Heading rendered above the panel content. |
| `model` | `string \| string[]` | — | Restrict the panel to one or more content-type UIDs. Omit to show the panel in every edit view. |
| `Component` | `React.ComponentType<EditViewPanelProps>` | ✅ | The React component to render inside the panel. |

### `EditViewPanelProps`

Your component receives these props:

| Prop | Type | Description |
|---|---|---|
| `model` | `string` | Content-type UID of the open record (e.g. `"plugin::better-auth.user"`). |
| `documentId` | `string \| undefined` | Strapi `documentId` of the record. Use this to fetch related data. |
| `document` | `Record<string, unknown> \| undefined` | Full Strapi document object. Contains all fields loaded by the detail view. |

### Available `model` values

| Model UID | Edit view |
|---|---|
| `plugin::better-auth.user` | User detail drawer |
| `plugin::better-auth.organization` | Organization detail view |

## Example component

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
