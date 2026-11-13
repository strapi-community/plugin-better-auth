---
id: dash-api
title: Dash API gateway
sidebar_position: 4
---

# Dash API gateway

The dashboard plugin can expose the Better Auth `dash()` endpoints as an HTTP
gateway for **third-party clients** — not the Strapi admin panel, and not MCP. It
forwards each request through the same signed-JWT mechanism the dashboard UI uses,
so Better Auth's own logic runs (validation, ban side-effects, stats aggregation).

This is useful when an external service needs to manage Better Auth users or read
analytics programmatically (dashboards, back-office tools, automations).

## Requirements

The gateway relies on the dashboard's usual setup: `dash()` + `jwt()` configured
and the default Better Auth `basePath` (`/api/auth`). See
[Installation → Configuration](./installation.md#configuration).

## Enabling

The gateway is **opt-in**:

```typescript title="config/plugins.ts"
export default {
  "better-auth-dashboard": {
    config: {
      dashApi: { enabled: true }, // default: false
    },
  },
};
```

:::note
Like the [MCP integration](./mcp.md), this is opt-in at registration: when
`dashApi.enabled` is `false` (the default) the routes are never mounted, so requests
to `/api/better-auth-dashboard/dash/*` return `404`.
:::

### Config reference

| Property | Type | Required | Description |
|---|---|---|---|
| `dashApi.enabled` | `boolean` | — | Mount the third-party dash gateway under `/api/better-auth-dashboard/dash/*`. Defaults to `false`. |

## Authentication

Authentication is Strapi's standard Content API token auth. Create a token in
_Settings → API Tokens_ and send it as a bearer token. Use a **Full access** token,
or a **Custom** token granted this gateway route's permission.

:::warning
This is a **generic passthrough to the whole dash surface** (including user deletion
and organization management) exposed as a single route, so granting it grants the
entire dash API — the gateway does not scope per dash endpoint. A Full access token
reaches everything. Create a **dedicated** token for the integration and treat it as
privileged. Leave `dashApi` disabled if you don't need it.
:::

## Usage

The path after `/dash/` is the Better Auth dash endpoint. Per-user or per-org
context (for example `{ userId }`) is passed in a base64(JSON) `X-Dash-Context`
header, exactly like the dashboard client.

```bash
# Analytics: overview stats
curl "$STRAPI/api/better-auth-dashboard/dash/user-stats" \
  -H "Authorization: Bearer $API_TOKEN"

# List / search users
curl "$STRAPI/api/better-auth-dashboard/dash/list-users?limit=50" \
  -H "Authorization: Bearer $API_TOKEN"

# Sign-up time series
curl "$STRAPI/api/better-auth-dashboard/dash/user-graph-data?period=daily" \
  -H "Authorization: Bearer $API_TOKEN"

# Ban a user (userId passed via X-Dash-Context)
curl -X POST "$STRAPI/api/better-auth-dashboard/dash/ban-user" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "X-Dash-Context: $(echo -n '{"userId":"42"}' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"banReason":"abuse"}'
```

The gateway returns the dash endpoint's JSON response and status code unchanged.

## How it works

The gateway is a Content API route that signs a short-lived JWT (carrying the
`BETTER_AUTH_DASHBOARD_SECRET` api-key hash plus any `X-Dash-Context` fields) and
invokes `auth.handler` at `/api/auth/dash/<path>`. It is the same server-to-server
mechanism the admin dashboard proxy uses, so it goes through Better Auth's business
logic rather than touching Strapi's database directly.

Authentication uses Strapi's built-in `content-api-token` strategy, which runs
before `plugin-api-permissions`' strategy — so a valid API token is never shadowed
by API Permissions.
