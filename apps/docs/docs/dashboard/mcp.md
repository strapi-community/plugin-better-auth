---
id: mcp
title: MCP server
sidebar_position: 3
---

# MCP server

The dashboard plugin can expose Better Auth **admin and analytics tools** on
Strapi's native [MCP server](https://docs.strapi.io/cms/features/strapi-mcp-server),
so AI clients (Claude, Cursor, …) can list, inspect, update and ban users and read
sign-up analytics over `POST /mcp`.

Every tool calls the Better Auth `dash()` plugin endpoints — the **same calls the
dashboard UI makes** — so Better Auth's own business logic runs (validation, ban
side-effects, stats aggregation).

## Requirements

- Strapi `>= 5.47` (the native MCP server).
- The dashboard's usual setup: `dash()` + `jwt()` configured and the default
  Better Auth `basePath` (`/api/auth`). See [Installation → Configuration](./installation.md#configuration).

## Enabling

The integration is **opt-in** and needs two switches: Strapi's own MCP server and
this plugin's tool registration.

```typescript title="config/server.ts"
export default ({ env }) => ({
  // ...existing config
  mcp: { enabled: true }, // Strapi's native MCP server (serves POST /mcp)
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

:::note
Registration happens in the plugin's `register()` phase (before the MCP server
starts). On Strapi versions below 5.47 there is no MCP server, so the plugin skips
tool registration — enabling the flag is harmless.
:::

## Authentication & permissions

MCP clients authenticate with an **admin API token** (Strapi admin panel →
_Settings → API Tokens_) sent as `Authorization: Bearer <token>`. Each tool is
gated by the **same permissions as the dashboard UI** — the token's admin role must
hold the relevant `Better Auth Dashboard` permission:

| Permission | Tools it unlocks |
|---|---|
| `user.read` | `better_auth_list_users`, `better_auth_get_user` |
| `user.update` | `better_auth_update_user`, `better_auth_ban_user`, `better_auth_unban_user` |
| `overview.read` | `better_auth_user_stats`, `better_auth_signups_graph` |

## Available tools

User tools identify the target by its **Better Auth user id** (as returned by
`better_auth_list_users`), exactly like the dashboard.

| Tool | Description |
|---|---|
| `better_auth_list_users` | List and search users (`search` matches name/email); returns users + total |
| `better_auth_get_user` | Fetch a single user by Better Auth `userId`, with session/account counts |
| `better_auth_update_user` | Update a user's `name` / `email` / `image` / `emailVerified` |
| `better_auth_ban_user` | Ban a user (optional reason + expiry in days); Better Auth revokes sessions¹ |
| `better_auth_unban_user` | Lift a user's ban¹ |
| `better_auth_user_stats` | Totals + day/week/month sign-ups (with % deltas)² + active users |
| `better_auth_signups_graph` | Sign-up time series by `period` (`daily` / `weekly` / `monthly`)²: per point, the users who signed up in it (`newUsers`), active users and the running total (`totalUsers`) |

¹ Registered only when the Better Auth [`admin`](https://www.better-auth.com/docs/plugins/admin)
plugin is configured (the `banned` field it adds must exist on the `user` schema),
matching the dashboard's adaptive behaviour.

² Periods are rolling windows counted back from the moment of the call, not
calendar days or months: `daily` is 7 windows of 24 hours, `weekly` 8 windows of
7 days and `monthly` 6 windows of 30 days. A point's `label` is the day or month
its window ends in. The stats compare the last 24 hours, 7 days and 30 days with
the same length of time just before.

## Trying it out

With both switches enabled, create an admin API token whose role has the
permissions above, then point your MCP client at `http://localhost:1337/mcp` with
that token as a bearer credential. The tools above appear in the client's tool list.
