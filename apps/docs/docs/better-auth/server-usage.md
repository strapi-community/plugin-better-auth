---
id: server-usage
title: Server Usage
sidebar_position: 5
---

# Server Usage

You can interact with the Better Auth instance directly from Strapi controllers, services, and middleware.

## Accessing the Better Auth instance

If you need access to the Better Auth api from your Strapi server code, you can simply import it from `src/lib/auth.ts`

```typescript
import { auth } from '@/lib/auth.ts';
```

## Reading the session in a controller

Use `auth.api.getSession` to verify the session from an incoming request:

```typescript title="src/api/my-resource/controllers/my-resource.ts"
import { auth } from '@/lib/auth.ts';

export default {
  async protectedAction(ctx) {
    const session = await auth.api.getSession({
      headers: ctx.request.headers,
    });

    if (!session) {
      return ctx.unauthorized('You must be logged in.');
    }

    // session.user — the authenticated user
    // session.session — the active session record
    ctx.body = { message: `Hello, ${session.user.name}!` };
  },
};
```

## Protecting routes with a policy

Strapi policies are the idiomatic way to guard routes. Create a global policy that checks for an active Better Auth session and apply it to any route that requires authentication.

```typescript title="src/policies/is-authenticated.ts"
import type { Core } from '@strapi/strapi';
import { auth } from '@/lib/auth.ts';

export default async (
  policyContext: any,
  _config: any,
  { strapi }: { strapi: Core.Strapi },
) => {
  const session = await auth.api.getSession({
    headers: policyContext.request.headers,
  });

  return session !== null;
};
```

Apply the policy to a route:

```typescript title="src/api/my-resource/routes/my-resource.ts"
export default {
  routes: [
    {
      method: 'GET',
      path: '/my-resource',
      handler: 'my-resource.find',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
  ],
};
```

Strapi will call the policy before the handler and automatically return a `403 Forbidden` response if it returns `false`.

## Interacting with Better Auth's data

Better Auth's own content types (`plugin::better-auth.user`, `.session`, `.account`, ...) carry business logic that needs to run alongside their CRUD operations — for example, creating a complementary account when a user is created. Because Better Auth is hosted inside Strapi, it's technically possible to bypass that logic entirely by writing to these content types straight through Strapi's document service:

```typescript
// Don't do this — it skips Better Auth's own business logic.
await strapi.documents('plugin::better-auth.user').create({
  data: { name: 'Jane', email: 'jane@example.com' },
});

// Do this instead.
await auth.api.signUpEmail({
  body: { name: 'Jane', email: 'jane@example.com', password: '...' },
});
```

To prevent this, direct document service writes (`create`, `update`, `delete`, and their `*Many` variants) to Better Auth's content types are blocked by default. Reads (`findOne`, `findMany`, `count`) are unaffected. If a write is blocked, you'll see an error like:

```
[@strapi-community/plugin-better-auth] Direct document service writes to "plugin::better-auth.user" are restricted, as they bypass Better Auth's own business logic for this operation. Use the Better Auth API instead, or set the 'unsafe_document_service' config option to true to disable this restriction.
```

If you have a use case that genuinely requires writing to these content types directly — and you understand the risk of bypassing Better Auth's business logic — disable the restriction with `unsafe_document_service`:

```typescript title="config/plugins.ts"
export default {
  'better-auth': {
    enabled: true,
    config: {
      unsafe_document_service: true,
    },
  },
};
```
