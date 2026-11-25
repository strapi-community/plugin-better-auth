# @strapi-community/plugin-better-auth-dashboard

## 1.3.1

### Patch Changes

- [#67](https://github.com/strapi-community/plugin-better-auth/pull/67) [`4f9f32c`](https://github.com/strapi-community/plugin-better-auth/commit/4f9f32ca31380b55cfccad40b81000141ac8a671) Thanks [@Link2Twenty](https://github.com/Link2Twenty)! - Fix the team members list in the organization detail view always showing as empty. The dashboard was sending a POST to the GET-only team members route, which returned a 403.

## 1.3.0

### Minor Changes

- [#64](https://github.com/strapi-community/plugin-better-auth/pull/64) [`caf542f`](https://github.com/strapi-community/plugin-better-auth/commit/caf542f06143657f8346961dbf80db8336781680) Thanks [@boazpoolman](https://github.com/boazpoolman)! - Make `createdAt` and `updatedAt` editable in the user and organization detail drawers. The dashboard db route now writes these timestamps straight to the table, since Strapi's document service would otherwise reset `updatedAt` to the current time on every update.

### Patch Changes

- [#63](https://github.com/strapi-community/plugin-better-auth/pull/63) [`b97ee38`](https://github.com/strapi-community/plugin-better-auth/commit/b97ee386ed70456f2f0fbf6c9e3ff0041f510141) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(dashboard): don't expose admin users through `/better-auth-dashboard/db`
  
  The list route no longer populates or filters on relations to `admin::` content
  types (such as the `createdBy`/`updatedBy` fields every content type has), which
  returned the related admin user including their password hash. `populate` now
  only accepts top-level relation fields; `*` and nested paths are ignored. This
  only applies to logged-in Strapi admins; the public Content API is not affected.

- [#58](https://github.com/strapi-community/plugin-better-auth/pull/58) [`0add43c`](https://github.com/strapi-community/plugin-better-auth/commit/0add43c416e8956e8f26eef29a5c9161c8cf9388) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(dashboard): saving a user when only custom fields changed
  
  Saving a user where only custom fields changed (for example a relation such as
  Roles) sent an empty update to Better Auth. `@better-auth/infra` 0.4 rejects
  that with "No valid fields to update", so the save failed. The dashboard now
  only updates the Better Auth user when one of its own fields changed.

- [#63](https://github.com/strapi-community/plugin-better-auth/pull/63) [`3aaba4d`](https://github.com/strapi-community/plugin-better-auth/commit/3aaba4d19b38cd36132b26dd846880ff3c482601) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(dashboard): save organization name and slug through Better Auth
  
  The organization detail drawer wrote `name` and `slug` straight to the
  database, so Better Auth's validation and organization hooks were skipped. They
  now go through Better Auth's `dash()` organization update, the same way the user
  drawer saves user fields. Changing an organization's slug to one that is
  already taken now shows "Slug already exists" instead of a database error.
  
  The logo is still saved directly, because Better Auth's update endpoint only
  accepts absolute URLs and would reject media library paths such as
  `/uploads/logo.png`.

- [#63](https://github.com/strapi-community/plugin-better-auth/pull/63) [`3aaba4d`](https://github.com/strapi-community/plugin-better-auth/commit/3aaba4d19b38cd36132b26dd846880ff3c482601) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(dashboard): match admin route permissions to the admin panel
  
  Some of the dashboard's admin API routes didn't fully check the admin's
  dashboard permissions, so an authenticated admin could call them without the
  permission the admin panel requires for the same action. This only applies to
  logged-in Strapi admins; the public Content API is not affected.
  
  Each route now requires the same dashboard permission as the matching action in
  the admin panel, and anything the panel doesn't do is denied:
  
  - Overview → `Overview: Read`; user and organization lists → `Read`;
    create dialogs → `Create`; deletes → `Delete`; the detail drawers and every
    action inside them → `Update`.
  - `dash()` endpoints the dashboard doesn't use (such as `execute-adapter`,
    `impersonate-user` and `export-users`) can't be called through the admin
    route.
  - `/better-auth-dashboard/db` only serves the Better Auth `user`, `session`,
    `passkey` and `organization` content types, and never `admin::` content
    types. Searching a custom relation field's target content type requires
    Content Manager read access to it, the same as in the Content Manager.
  
  If an admin role used the dashboard without the matching permission, grant it
  under Settings → Roles → Plugins → Better Auth Dashboard.

## 1.2.0

### Minor Changes

- [#59](https://github.com/strapi-community/plugin-better-auth/pull/59) [`4d0c528`](https://github.com/strapi-community/plugin-better-auth/commit/4d0c5282bc09606d89fff1b512f50e41dbf35705) Thanks [@unrevised6419](https://github.com/unrevised6419)! - Show a "Passkeys" section in the user drawer's Security tab when the Better Auth `passkey()` plugin is configured. It lists each passkey (name, device type, backup state, creation date) with a delete action and an empty state. "Linked accounts" no longer implies that a passkey-only user has no way to sign in. Adds an admin-only `DELETE /better-auth-dashboard/db/:documentId` route that only deletes passkeys, and only one belonging to the given `userId`.

## 1.1.3

### Patch Changes

- [#57](https://github.com/strapi-community/plugin-better-auth/pull/57) [`7fd5175`](https://github.com/strapi-community/plugin-better-auth/commit/7fd51756453fc4f8fa5a1eb1364e95aeb5b73b65) Thanks [@boazpoolman](https://github.com/boazpoolman)! - Fix the Overview page crashing with "Objects are not valid as a React child" when hovering a retention row. The Better Auth client parses the retention window dates into `Date` objects, which were passed straight into the hover text; they're now formatted as UTC dates.

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
