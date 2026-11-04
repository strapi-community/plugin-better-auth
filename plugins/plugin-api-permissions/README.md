# Strapi API Permissions

Content API RBAC for [Strapi](https://strapi.io) — auth-provider agnostic roles and permissions. This plugin gives you a role management UI in the Strapi admin and a pluggable session resolver so any authentication provider can drive your Content API access control.

## Features

- ✅ Role management UI in the Strapi admin panel
- ✅ Fine-grained permissions per content type (find, findOne, create, update, delete)
- ✅ Plugin endpoint permissions support
- ✅ Two default roles created on first run: **Public** and **Authenticated**
- ✅ Pluggable session resolver — wire in any auth provider
- ✅ Auth-provider agnostic — works standalone or paired with `plugin-better-auth`
- ✅ Automatically extends your user content type with a `roles` relation
- ✅ Works with Strapi v5+

## Installation

```bash
npm install @strapi-community/plugin-api-permissions
# or
yarn add @strapi-community/plugin-api-permissions
# or
pnpm add @strapi-community/plugin-api-permissions
```

## Usage

### 1. Register the plugin

Add the plugin to your Strapi configuration:

```typescript
// config/plugins.ts
export default {
  'api-permissions': {
    enabled: true,
  },
};
```

### 2. Set the user content type (if not using plugin-better-auth)

The plugin needs to know which content type represents your users so it can count role members and reassign users when a role is deleted. If you are using [`plugin-better-auth`](../plugin-better-auth/README.md), this is resolved automatically. Otherwise, set the `user_uid` option:

```typescript
// config/plugins.ts
export default {
  'api-permissions': {
    enabled: true,
    config: {
      user_uid: 'plugin::users-permissions.user',
    },
  },
};
```

### 3. Register a session resolver

The session resolver is called on every Content API request. It receives the Koa context and must return the current user and their roles, or `null` for unauthenticated requests. Register it in your Strapi bootstrap:

```typescript
// src/index.ts
import type { Modules } from '@strapi/strapi';

export default {
  async bootstrap({ strapi }) {
    strapi
      .plugin('api-permissions')
      .service('session')
      .registerSessionResolver(async (ctx) => {
        const token = ctx.request.headers.authorization?.replace('Bearer ', '');
        if (!token) return null;

        const session = await myAuthProvider.verifyToken(token);
        if (!session) return null;

        const user = await strapi.documents('plugin::my-auth.user').findFirst({
          filters: { id: session.userId },
        });

        const roles = await strapi.documents('plugin::api-permissions.role').findMany({
          filters: { type: session.roleType },
        }) as Modules.Documents.Document<'plugin::api-permissions.role'>[];

        return { user, roles };
      });
  },
};
```

### Using with plugin-better-auth

When [`plugin-better-auth`](../plugin-better-auth/README.md) is installed alongside this plugin, the session resolver is registered automatically — no manual setup required. Just enable both plugins:

```typescript
// config/plugins.ts
export default {
  'better-auth': {
    enabled: true,
  },
  'api-permissions': {
    enabled: true,
  },
};
```

Users authenticated through Better Auth are matched against the **Authenticated** role. Unauthenticated requests fall back to the **Public** role.

## How it works

On startup the plugin:

1. Extends your user content type with a `roles` manyToMany relation pointing to `plugin::api-permissions.role`.
2. Registers a `content-api` authentication strategy with Strapi that runs on every Content API request.
3. Seeds the database with **Public** and **Authenticated** roles if none exist yet.

On each Content API request the strategy:

1. Calls your registered session resolver with the Koa context.
2. Loads the permissions for the resolved role(s), falling back to the **Public** role for unauthenticated requests.
3. Generates a CASL ability from those permissions and attaches it to the request.

## Admin panel

Navigate to **Settings → API Permissions → Roles** to manage roles. From there you can:

- Create custom roles with any combination of content type and plugin permissions.
- Edit which actions (find, findOne, create, update, delete) are enabled per role.
- Delete roles — users are automatically reassigned to the Public role on deletion.

> [!NOTE]
> The **Public** role cannot be deleted.

## Authors

- [Boaz Poolman](https://github.com/boazpoolman)
- [Marco Autiero](https://github.com/maccomaccomaccomacco)

## License

See the [LICENSE](./LICENSE.md) file for licensing information.
