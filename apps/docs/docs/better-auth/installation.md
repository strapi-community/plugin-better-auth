---
id: installation
title: Installation
sidebar_position: 2
---

# Installation

## 1. Install the packages

Install `better-auth` and `@strapi-community/plugin-better-auth` together:

```bash
npm install better-auth @strapi-community/plugin-better-auth
# or
yarn add better-auth @strapi-community/plugin-better-auth
# or
pnpm add better-auth @strapi-community/plugin-better-auth
```

:::note
You must to be running **Strapi 5.45.0** or higher.
:::

## 2. Enable the plugin

Add the plugin to your Strapi plugin configuration:

```typescript title="config/plugins.ts"
export default {
  'better-auth': {
    enabled: true,
  },
};
```

## 3. Create a Better Auth config file

Create a Better Auth configuration file that uses the Strapi adapter:

```typescript title="src/lib/auth.ts"
import { betterAuth } from 'better-auth';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
});
```

:::note
No `generateId` configuration is required — the adapter stores Better Auth's
native id as Strapi's `documentId`. If you prefer numeric, auto-incremented ids,
set `advanced.database.generateId: 'serial'`. See [Configuration](./configuration#id-strategy).
:::

## 4. Generate the schema

The plugin does not register any content types automatically. You must run the Better Auth CLI to generate the Strapi schema files:

```bash
npx auth generate
```

## 5. Start Strapi

Start Strapi in development mode. The generated content types will be picked up and registered:

```bash
pnpm develop
```

The Better Auth API is now available at `http://localhost:1337/api/auth/`.
