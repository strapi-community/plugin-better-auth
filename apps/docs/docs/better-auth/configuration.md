---
id: configuration
title: Configuration
sidebar_position: 3
---

# Configuration

## Better Auth config

The Better Auth config file (`src/lib/auth.ts`) is the central place for configuring authentication behaviour. It is a factory function that returns a configured Better Auth instance so Strapi can initialise it after the plugin system is ready.

```typescript title="src/lib/auth.ts"
import { betterAuth } from 'better-auth';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
});
```

## ID strategy

The adapter works with Better Auth's native id strategy out of the box — no
configuration required. Better Auth generates the id (its default random string,
or a UUID if you set `generateId: 'uuid'`) and the adapter stores it as Strapi's
`documentId`.

If you prefer numeric, auto-incremented ids, set `generateId: 'serial'` and the
adapter stores records under Strapi's numeric `id` instead:

```typescript title="src/lib/auth.ts"
export const auth = betterAuth({
  // ...
  advanced: {
    database: {
      generateId: 'serial',
    },
  },
});
```

Both strategies declare database foreign keys with `ON DELETE CASCADE`, so Better
Auth's cascade deletes work (deleting a user removes its sessions and accounts,
deleting an organization removes its members, and so on).

:::caution One row per document
Better Auth content types must be exactly **one database row per document**. Do
not enable **Draft & Publish** or **internationalization (i18n)** on them — both
store multiple rows per document, which breaks Better Auth's model and its cascade
deletes. The plugin disables these and the app will fail to start with a clear
error if it finds them enabled on a Better Auth content type.
:::

## Trusted origins

Better Auth protects against CSRF attacks by validating that requests come from a known origin. In a typical Strapi setup, your front-end app runs on a different origin than Strapi (e.g. `http://localhost:3000` vs `http://localhost:1337`). Without listing your front-end URL in `trustedOrigins`, Better Auth will reject those cross-origin requests.

Add the URL of your front-end to `trustedOrigins`:

```typescript title="src/lib/auth.ts"
export const auth = betterAuth({
  // ...
  trustedOrigins: ['http://localhost:3000'],
});
```

In production set this to the public URL of your deployed front-end. Multiple origins can be listed if needed.

## Base path

By default, Better Auth exposes its endpoints under `/api/auth`. If you need to change this — for example to avoid a conflict with an existing route or to match a client SDK configured with a custom path — set `basePath` in the Better Auth config:

```typescript title="src/lib/auth.ts"
export const auth = betterAuth({
  // ...
  basePath: '/api/better-auth',
});
```

:::note
The path must start with the API prefix (default `/api`). If you have customized `api.rest.prefix` in your Strapi config, make sure the `basePath` starts with that prefix instead.
:::

## Cookie settings

In production you typically want secure, cross-site cookies. Set the `defaultCookieAttributes` option based on your environment:

```typescript title="src/lib/auth.ts"
export const auth = betterAuth({
  // ...
  trustedOrigins: ['http://localhost:3000'],
  advanced: {
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  },
});
```

This is required when your front-end and Strapi are on different origins (e.g. a separate Vercel deployment talking to Strapi Cloud).

## Environment variables

Set the following in your `.env` file:

```bash title=".env"
# Required in production — used to sign sessions
BETTER_AUTH_SECRET=your-secret-here

# The public URL your Strapi instance is reachable at
BETTER_AUTH_URL=http://localhost:1337
```

Pass them to the config:

```typescript title="src/lib/auth.ts"
import { betterAuth } from 'better-auth';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';

export const auth = betterAuth({
  database: strapiAdapter(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: ['http://localhost:3000'],
});
```
