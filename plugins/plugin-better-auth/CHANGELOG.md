# @strapi-community/plugin-better-auth

## 1.1.0

### Minor Changes

- [#54](https://github.com/strapi-community/plugin-better-auth/pull/54) [`1339df9`](https://github.com/strapi-community/plugin-better-auth/commit/1339df900f1341ea5c5f93b6ec17972f585d8e2a) Thanks [@boazpoolman](https://github.com/boazpoolman)! - feat(adapter): support case-insensitive filtering
  
  Honour Better Auth's `mode: "insensitive"` on where conditions by mapping to
  Strapi's case-insensitive operators (`$eqi`, `$nei`, `$containsi`, `$startsWithi`,
  `$endsWithi`). `in`/`not_in` have no case-insensitive Strapi operator, so they are
  expanded into an `$or`/`$and` group of `$eqi`/`$nei` conditions.

- [#54](https://github.com/strapi-community/plugin-better-auth/pull/54) [`1339df9`](https://github.com/strapi-community/plugin-better-auth/commit/1339df900f1341ea5c5f93b6ec17972f585d8e2a) Thanks [@boazpoolman](https://github.com/boazpoolman)! - feat(adapter): resolve Better Auth joins natively
  
  When `experimental.joins` is enabled, Better Auth delegates joins to the adapter
  instead of emulating them with extra round-trips. The adapter now resolves each
  requested join against Strapi's document service — matching `on.from`/`on.to`,
  honouring one-to-one vs one-to-many and the per-join limit — and attaches the
  related rows so Better Auth's output transformer can read them back.

- [#54](https://github.com/strapi-community/plugin-better-auth/pull/54) [`1339df9`](https://github.com/strapi-community/plugin-better-auth/commit/1339df900f1341ea5c5f93b6ec17972f585d8e2a) Thanks [@boazpoolman](https://github.com/boazpoolman)! - feat(adapter): support atomic transactions
  
  The adapter now exposes a `transaction` implementation that runs the callback
  inside `strapi.db.transaction`. Strapi's document service joins that transaction
  through async-local storage, so a group of writes is atomic and a thrown error
  rolls the whole batch back.

- [#50](https://github.com/strapi-community/plugin-better-auth/pull/50) [`b6832e0`](https://github.com/strapi-community/plugin-better-auth/commit/b6832e0c6d4e6004769eb013b703b05c5cc39c8b) Thanks [@boazpoolman](https://github.com/boazpoolman)! - feat: add a migration path from the users-permissions plugin
  
  Adds a one-time, idempotent migration from Strapi's users-permissions plugin to Better Auth. Enabling the new `migration` plugin option relaxes the boot guard so both plugins can run together, and at bootstrap it migrates users and their bcrypt credentials into Better Auth's `user`/`account` content types, maps roles and (best-effort) permissions onto API Permissions when it's installed, and defers OAuth users to re-link by email. A new `@strapi-community/plugin-better-auth/migration` entry point exports `usersPermissionsPasswordCompat()` and `rehashBcryptOnSignIn`, so existing bcrypt passwords keep working and transparently upgrade to scrypt on the next successful sign-in. See the migration guide for the full cutover steps.

### Patch Changes

- [#54](https://github.com/strapi-community/plugin-better-auth/pull/54) [`eb3019c`](https://github.com/strapi-community/plugin-better-auth/commit/eb3019cb29db109c70ab8ce2e6b89b346632e8d7) Thanks [@boazpoolman](https://github.com/boazpoolman)! - fix(adapter): require `generateId: "serial"` and fail fast otherwise
  
  The adapter stores records using Strapi's numeric id and relies on integer
  foreign keys with `ON DELETE CASCADE`, which Better Auth needs for its cascade
  deletes (removing a user clears their sessions and accounts, and so on). Other id
  strategies (UUID, the default random string, custom generators) silently broke
  relations and cascades, so the adapter now throws a clear error at startup when
  `advanced.database.generateId` is not `"serial"`.

## 1.0.1

### Patch Changes

- [#52](https://github.com/strapi-community/plugin-better-auth/pull/52) [`6d4b36c`](https://github.com/strapi-community/plugin-better-auth/commit/6d4b36c0fd094d52a4f0495d2bdc860b88f5378d) Thanks [@PaulBratslavsky](https://github.com/PaulBratslavsky)! - fix(adapter): keep every AND condition when several target the same field
  
  The adapter merged Better Auth's AND conditions into one Strapi filter object, so
  a second condition on the same field replaced the first. A range such as
  `createdAt > start AND createdAt <= end` lost its lower bound and matched every
  row up to `end`. This broke the dashboard's sign-up figures: in the sign-ups graph
  (and the `better_auth_signups_graph` MCP tool) `newUsers` equalled the running
  total, and the user stats compared each period with all earlier users instead of
  the previous period. Several AND conditions now go in a `$and` filter.

## 1.0.0

### Major Changes

- [#43](https://github.com/strapi-community/plugin-better-auth/pull/43) [`673372c`](https://github.com/strapi-community/plugin-better-auth/commit/673372ca2913acc79f2bc2265186a991431e55c0) Thanks [@boazpoolman](https://github.com/boazpoolman)! - ## First stable release 🎉
  _No changes since latest beta release._
