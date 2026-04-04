# @strapi-community/migrate-auth

Migration utilities for moving user data from Strapi's built-in `users-permissions` plugin to [`@strapi-community/plugin-better-auth`](https://github.com/strapi-community/plugin-better-auth).

## Prerequisites

Both plugins must be installed and configured in your Strapi project before running a migration:

- [`@strapi/plugin-users-permissions`](https://docs.strapi.io/dev-docs/plugins/users-permissions) — the migration source
- [`@strapi-community/plugin-better-auth`](https://github.com/strapi-community/plugin-better-auth) — the migration destination
- `@strapi-community/plugin-api-permissions` — required for role migration

## Installation

```bash
npm install @strapi-community/migrate-auth
# or
pnpm add @strapi-community/migrate-auth
```

## Overview

The migration runs in two independent steps:

1. **`migrateUsers`** — copies user records and their credentials/OAuth accounts from `users-permissions` to Better Auth.
2. **`migrateRoles`** — copies roles from `users-permissions` to `api-permissions` and re-assigns already-migrated Better Auth users to their new roles.

Always run `migrateUsers` before `migrateRoles`.

## Usage

The recommended approach is to run the migration inside a [Strapi bootstrap function](https://docs.strapi.io/dev-docs/configurations/functions#bootstrap) or a custom Strapi command, where the fully-initialized `strapi` instance is available.

### 1. Migrate users

```ts
// src/index.ts  (or any file that has access to the strapi instance)
import {
  UsersPermissionsSource,
  BetterAuthDestination,
  migrateUsers,
} from '@strapi-community/migrate-auth';

export default {
  async bootstrap({ strapi }) {
    const report = await migrateUsers({
      source: new UsersPermissionsSource(strapi),
      destination: new BetterAuthDestination(strapi),
    });

    console.log('User migration complete', report);
    // { total: 120, migrated: 118, skipped: 2, errors: [] }
  },
};
```

### 2. Migrate roles

Run this after `migrateUsers` so that Better Auth users exist and can be connected to their roles.

```ts
import { migrateRoles } from '@strapi-community/migrate-auth';

const report = await migrateRoles(strapi);

console.log('Role migration complete', report);
// { total: 3, created: 2, skipped: 1, assigned: 118, errors: [] }
```

### 3. Full migration example

```ts
// src/index.ts
import {
  UsersPermissionsSource,
  BetterAuthDestination,
  migrateUsers,
  migrateRoles,
} from '@strapi-community/migrate-auth';

export default {
  async bootstrap({ strapi }) {
    // Step 1 — users
    const userReport = await migrateUsers({
      source: new UsersPermissionsSource(strapi),
      destination: new BetterAuthDestination(strapi),
      skipExisting: true, // default — safe to re-run
    });
    console.log('Users:', userReport);

    // Step 2 — roles (requires users to exist first)
    const roleReport = await migrateRoles(strapi);
    console.log('Roles:', roleReport);
  },
};
```

## Options

### `migrateUsers(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | `SourceAdapter` | — | Reads users from the source auth provider |
| `destination` | `DestinationAdapter` | — | Writes users to the destination auth provider |
| `dryRun` | `boolean` | `false` | Runs queries but writes nothing. Reports accurate `total` and `skipped` counts; `migrated` will be `0`. |
| `skipExisting` | `boolean` | `true` | Skips users whose email already exists in the destination. Safe to re-run. |
| `batchSize` | `number` | `100` | Number of users fetched from the source per batch. |

Returns a `MigrationReport`:

```ts
interface MigrationReport {
  total: number;    // users found in source
  migrated: number; // users written to destination
  skipped: number;  // users skipped (already existed)
  errors: Array<{ email: string; reason: string }>;
}
```

### `migrateRoles(strapi, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `dryRun` | `boolean` | `false` | Counts roles and assignments without writing any records. |

Returns a `RoleMigrationReport`:

```ts
interface RoleMigrationReport {
  total: number;    // source roles found
  created: number;  // new roles created in api-permissions
  skipped: number;  // roles that already existed
  assigned: number; // users whose role was updated
  errors: Array<{ name: string; reason: string }>;
}
```

## Dry-run mode

Use `dryRun: true` to preview what the migration will do before committing any changes:

```ts
const report = await migrateUsers({
  source: new UsersPermissionsSource(strapi),
  destination: new BetterAuthDestination(strapi),
  dryRun: true,
});
// report.migrated === 0, report.total shows actual count
```

```ts
const report = await migrateRoles(strapi, { dryRun: true });
// No roles or assignments are written
```

## bcrypt password compatibility

`users-permissions` stores passwords as **bcrypt** hashes. Better Auth uses **scrypt** by default. Without extra configuration, migrated users cannot sign in after migration.

Use `createBcryptCompatiblePassword()` in your Better Auth config to handle both hash formats transparently:

```ts
// config/better-auth.ts
import { betterAuth } from 'better-auth';
import { createBcryptCompatiblePassword } from '@strapi-community/migrate-auth';

export default betterAuth({
  emailAndPassword: {
    enabled: true,
    password: createBcryptCompatiblePassword(),
  },
  // ...rest of your config
});
```

This configures Better Auth to:
- **Hash** new passwords with scrypt (Better Auth default).
- **Verify** passwords by detecting the hash format:
  - `$2…` prefix → bcrypt (migrated users)
  - anything else → scrypt (new users)

> Migrated users keep their bcrypt hash until they reset their password or you run a separate re-hashing pass.

## Custom adapters

The migration engine is decoupled from any specific provider. You can implement the `SourceAdapter` or `DestinationAdapter` interfaces to migrate from or to a different system.

```ts
import type { SourceAdapter, SourceUser } from '@strapi-community/migrate-auth';

class MyCustomSource implements SourceAdapter {
  async getUserCount(): Promise<number> {
    // return total user count from your system
  }

  async getUsers(options: { limit: number; offset: number }): Promise<SourceUser[]> {
    // return a page of users mapped to the SourceUser shape
  }
}
```

Then pass your adapter to `migrateUsers`:

```ts
await migrateUsers({
  source: new MyCustomSource(),
  destination: new BetterAuthDestination(strapi),
});
```

## Field mapping

### `UsersPermissionsSource`

| `users-permissions` field | `SourceUser` field |
|---|---|
| `username` | `name` |
| `email` | `email` |
| `confirmed` | `emailVerified` |
| `password` (local users only) | `password` |
| `provider` | `provider` |
| `role` (relation) | `role` |

### `BetterAuthDestination`

For each source user the adapter creates two records:

- A `plugin::better-auth.user` record with `name`, `email`, and `emailVerified`.
- A `plugin::better-auth.account` record:
  - Local users → `providerId: "credential"`, password hash stored as-is.
  - OAuth users → `providerId: <provider>` (e.g. `"google"`), no password.

## License

MIT
