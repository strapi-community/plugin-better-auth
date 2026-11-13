# playground-up-migration

A Strapi app used to test the **users-permissions → Better Auth** migration. It
installs `@strapi/plugin-users-permissions`, `plugin-better-auth` and
`plugin-api-permissions` together, with Better Auth's `migration` option enabled
(see `config/plugins.ts`) so the two auth plugins can run side by side.

The automated test lives in
`plugins/plugin-better-auth/server/test/users-permissions-migration.test.ts`:
it boots this app, seeds users-permissions roles/permissions/users, runs the
migration, and asserts the result (including bcrypt sign-in + scrypt rehash).

## How the migration runs here

With `migration.enabled`, Better Auth runs the migration once at bootstrap (it
reads any existing users-permissions data and writes it into Better Auth +
API Permissions, then records completion in the plugin store). So the migration
fires automatically the first time this app boots against a database that still
has users-permissions data.

The automated test is the deterministic way to exercise it — it seeds the
users-permissions data first, then invokes the migration directly, which sidesteps
the boot-ordering between seeding and the bootstrap run.

## Manual poking

```bash
# From the repo root
pnpm --filter playground-up-migration console
```

From the console you can create `plugin::users-permissions.user` rows, then
inspect the result of a boot-time migration, or read the completion marker:

```js
await strapi.store({ type: "plugin", name: "better-auth" })
  .get({ key: "users-permissions-migration" });
```

> The Better Auth content types under `src/extensions/better-auth` are generated
> (`npx auth generate`) from `src/lib/auth.ts`. They mirror the main playground's
> schema (same Better Auth plugins), minus the dashboard.
