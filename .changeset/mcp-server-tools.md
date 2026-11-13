---
"@strapi-community/plugin-better-auth-dashboard": minor
---

Add an opt-in integration with Strapi's native MCP server (Strapi >= 5.47). When enabled via `mcp: { enabled: true }` in the plugin config, the dashboard registers Better Auth admin and analytics tools on `strapi.ai.mcp` so AI clients can list, get, update and ban users and read sign-up statistics over `POST /mcp`. Every tool calls the Better Auth `dash()` endpoints — the same calls the dashboard UI makes — and is gated by the same admin permissions as the dashboard, authenticated with an admin API token.
