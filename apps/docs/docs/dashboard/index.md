---
id: dashboard
title: Dashboard
sidebar_label: Overview
sidebar_position: 1
---

# Dashboard

A pre-built dashboard can be installed separately that runs inside your Strapi admin panel. See usage information like DAU, manage sessions, disable 2FA and much more.

The dashboard plugin also exposes its admin and analytics capabilities beyond the admin UI: as tools on Strapi's native [MCP server](./mcp.md) for AI clients, and as an HTTP [Dash API gateway](./dash-api.md) for third-party services. Both are opt-in.

## Getting started

- [Installation](./installation.md) — install and configure the plugin.
- [MCP server](./mcp.md) — expose Better Auth admin/analytics tools to AI clients.
- [Dash API gateway](./dash-api.md) — call the Better Auth `dash()` endpoints from third-party services.
- [Dashboard screen API](./screen-api.md) — add sections and screens from other plugins.
- [Edit view panel API](./edit-view-panel.md) — inject sidebar panels into the user and organization detail views.

## Adaptive UI

The dashboard detects which Better Auth plugins you have enabled and adapts its interface automatically:

| Better Auth plugin | Dashboard effect |
|---|---|
| `admin` (ban users) | Enables the **Ban** action on users and bulk ban in the Users page |
| `organization` | Adds the **Organizations** page to the navigation |
| `twoFactor` | Shows 2FA enrollment status in the user detail drawer |
| `emailVerification` | Shows email verification status and exposes a resend action |
