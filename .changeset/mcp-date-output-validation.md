---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(mcp): normalize dash() Date fields so the user tools pass MCP output validation

The dash() endpoints return `createdAt`/`updatedAt` (and `banExpires`) as JS `Date`
objects, which are neither a string nor a number and so failed the tools' output
schema — `better_auth_list_users`, `better_auth_get_user` and `better_auth_update_user`
errored with "Invalid input" on every user row. These date fields are now coerced to
ISO strings, and `better_auth_signups_graph` likewise emits ISO `date` values instead
of locale `String(Date)` strings.
