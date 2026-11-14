---
id: migration
title: Migrate from Users & Permissions
sidebar_position: 5
---

# Migrate from Users & Permissions

This guide moves an existing Strapi app from the built-in **Users & Permissions**
(U&P) plugin to **Better Auth** + **API Permissions**, without forcing your users
to reset their passwords.

The migration runs automatically at boot while both plugins are installed: it
reads your U&P users, credentials, roles and permissions, and writes them into
Better Auth's `user`/`account` content types and API Permissions roles.

:::caution Back up your database first
The migration writes new records based on your existing data. Take a database
backup (or run against a copy) before you start, and use **dry run** (below) to
preview the result.
:::

## How passwords are handled

U&P hashes passwords with **bcrypt**; Better Auth defaults to **scrypt**. The
migration copies your bcrypt hashes verbatim into Better Auth's `account` table,
and a small compatibility layer keeps them working:

- Existing bcrypt hashes are verified with bcrypt.
- On the next successful sign-in, that user's password is transparently
  re-hashed to scrypt (Better Auth's default).

No password resets are required.

## Prerequisites

- `@strapi-community/plugin-better-auth` installed and enabled.
- A Better Auth config (`auth.ts`) — see [Getting started](./better-auth).
- The U&P plugin still installed (it is removed at the end).
- `@strapi-community/plugin-api-permissions` installed **only if** you use it for
  Content API role-based permissions and want those role and permission
  assignments migrated. It is optional — without it, users and credentials are
  still migrated and the role/permission steps are simply skipped.

## Step 1 — Enable migration mode

Normally Better Auth refuses to boot alongside U&P. Enable the `migration`
option to allow them to run together for the migration:

```typescript title="config/plugins.ts"
export default {
  'better-auth': {
    enabled: true,
    config: {
      migration: {
        enabled: true,
        // Preview only — logs what would happen and writes nothing.
        dryRun: false,
      },
    },
  },
};
```

You can also enable it with the `BETTER_AUTH_MIGRATE_FROM_USERS_PERMISSIONS=true`
environment variable.

## Step 2 — Generate the Better Auth schema

The migration writes into Better Auth's content types, so they must exist first:

```bash
npx auth generate
```

## Step 3 — Add the password compatibility layer

Wire the bcrypt helpers into your `auth.ts` so migrated passwords keep working
and upgrade to scrypt over time:

```typescript title="src/lib/auth.ts"
import { betterAuth } from 'better-auth';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';
import {
  usersPermissionsPasswordCompat,
  rehashBcryptOnSignIn,
} from '@strapi-community/plugin-better-auth/migration';

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: usersPermissionsPasswordCompat(),
  },
  hooks: {
    after: rehashBcryptOnSignIn,
  },
  database: strapiAdapter(),
});
```

## Step 4 — Boot and review

Start Strapi. The migration runs once and logs a summary, for example:

```
[@strapi-community/plugin-better-auth] users-permissions migration complete:
  42 user(s), 40 credential account(s), 2 OAuth user(s) deferred to re-link,
  0 skipped, 0 failed, 1 role(s) created, 18 permission(s) linked (6 action(s) dropped).
```

With `dryRun: true` nothing is written — use it to preview the counts, then set
it back to `false` and boot again to apply. A completed migration is recorded in
the plugin store, so it will not run twice; users already present in Better Auth
(matched by email) are skipped, so a re-run after a partial failure is safe.

Review the migrated roles and permissions in **Settings → API Permissions → Roles**.

## Step 5 — Finish the cutover

Once you've verified the data and that sign-in works:

1. Remove the `@strapi/plugin-users-permissions` plugin.
2. Remove the `migration` option (or the env var).
3. Keep the password compatibility layer from Step 3 in place until all users
   have signed in at least once (that's when their hash upgrades to scrypt).

## What is migrated

| From Users & Permissions | To |
|---|---|
| User (`username`, `email`, `confirmed`, `blocked`) | `plugin::better-auth.user` (`name`, `email`, `emailVerified`, `banned`) |
| Local password (bcrypt hash) | `plugin::better-auth.account` (`providerId: "credential"`) |
| Role (single) | `plugin::api-permissions.role`, assigned via the user's `roles` relation |
| Role permissions (`api::…`, `plugin::…` actions) | API Permissions permissions (best-effort) |
| Custom user fields present on both schemas | Copied verbatim |

## Known limitations

- **Relations to the old user.** Other content types with a relation to
  `plugin::users-permissions.user` are **not** repointed automatically to
  `plugin::better-auth.user`. Retarget those relations manually.
- **OAuth / social users.** U&P does not store the external provider account id,
  so social users get no credential account. They are migrated as verified users
  and re-link by email on their next social sign-in (ensure the provider is in
  Better Auth's `account.accountLinking.trustedProviders`).
- **Sessions.** Existing JWT sessions are not migrated; users sign in again.
- **Permissions.** Only actions that exist in API Permissions are carried over;
  U&P's own auth/plugin actions are dropped. Review the result before going live.

If you hit a problem or want to improve the tooling, please open a discussion on
[GitHub](https://github.com/strapi-community/plugin-better-auth).
