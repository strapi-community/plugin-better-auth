# @strapi-community/plugin-better-auth-dashboard

## 1.1.2

### Patch Changes

- [`1fa1996`](https://github.com/strapi-community/plugin-better-auth/commit/1fa19967cd5a0bbe5b9c1d4d016c21b5f9eafc8b) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(dashboard): link relation custom field values to their Content Manager item
  
  Relation custom fields in the user and organization edit panels now render each
  assigned value as a link to that item's Content Manager edit view, instead of
  plain text. The target's content-type kind is resolved so single types and
  collection types get the correct route.

## 1.1.1

### Patch Changes

- [#48](https://github.com/strapi-community/plugin-better-auth/pull/48) [`63e570a`](https://github.com/strapi-community/plugin-better-auth/commit/63e570a615fd9908523d23b26c2894c6ef4fbac4) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(mcp): normalize dash() Date fields so the user tools pass MCP output validation
  
  The dash() endpoints return `createdAt`/`updatedAt` (and `banExpires`) as JS `Date`
  objects, which are neither a string nor a number and so failed the tools' output
  schema — `better_auth_list_users`, `better_auth_get_user` and `better_auth_update_user`
  errored with "Invalid input" on every user row. These date fields are now coerced to
  ISO strings, and `better_auth_signups_graph` likewise emits ISO `date` values instead
  of locale `String(Date)` strings.

## 1.1.0

### Minor Changes

- [#47](https://github.com/strapi-community/plugin-better-auth/pull/47) [`a07e6c7`](https://github.com/strapi-community/plugin-better-auth/commit/a07e6c70cb7bfcf68f5fb06bbd1122bca37d3e90) Thanks [@boazpoolman](https://github.com/boazpoolman)! - Add an opt-in third-party HTTP gateway to the Better Auth `dash()` endpoints. When enabled via `dashApi: { enabled: true }` in the plugin config, the plugin mounts `/api/better-auth-dashboard/dash/*`, authenticated with a Strapi API token, and forwards each request through the same signed-JWT mechanism the dashboard uses (so Better Auth's own logic runs). This lets external services manage users and read analytics without the admin panel. Disabled by default — when off, the routes are not registered.

- [#47](https://github.com/strapi-community/plugin-better-auth/pull/47) [`a07e6c7`](https://github.com/strapi-community/plugin-better-auth/commit/a07e6c70cb7bfcf68f5fb06bbd1122bca37d3e90) Thanks [@boazpoolman](https://github.com/boazpoolman)! - Add an opt-in integration with Strapi's native MCP server (Strapi >= 5.47). When enabled via `mcp: { enabled: true }` in the plugin config, the dashboard registers Better Auth admin and analytics tools on `strapi.ai.mcp` so AI clients can list, get, update and ban users and read sign-up statistics over `POST /mcp`. Every tool calls the Better Auth `dash()` endpoints — the same calls the dashboard UI makes — and is gated by the same admin permissions as the dashboard, authenticated with an admin API token.

### Patch Changes

- [#45](https://github.com/strapi-community/plugin-better-auth/pull/45) [`32d2e32`](https://github.com/strapi-community/plugin-better-auth/commit/32d2e324ae8e9136eb5d8e0deb814f1a3320ec26) Thanks [@boazpoolman](https://github.com/boazpoolman)! - Fix relation custom fields not showing their value in the organization edit panel. The organization detail view fetched its record without populating relations, so relation custom fields rendered empty. It now populates relation fields from the schema, matching the user detail panel.

## 1.0.0

### Major Changes

- [#43](https://github.com/strapi-community/plugin-better-auth/pull/43) [`673372c`](https://github.com/strapi-community/plugin-better-auth/commit/673372ca2913acc79f2bc2265186a991431e55c0) Thanks [@boazpoolman](https://github.com/boazpoolman)! - ## First stable release 🎉
  _No changes since latest beta release._
