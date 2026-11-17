---
id: schema
title: Schema
sidebar_position: 5
---

# Schema

## Table prefix

By default the plugin prefixes all Better Auth database tables with `ba_` (e.g. `ba_user`, `ba_session`). You can change this through the plugin config:

```typescript title="config/plugins.ts"
export default {
  "better-auth": {
    enabled: true,
    config: {
      table_prefix: "auth_",
    },
  },
};
```

The prefix must be snake_case and end with an underscore (e.g. `auth_`, `myapp_auth_`).

:::caution
Changing the prefix on an existing installation will rename all tables. Run a database migration to move existing data or you will lose it.
:::

## Table names

Better Auth lets you override the name of each individual model through the Better Auth config. This is useful if you need to avoid conflicts with existing tables or follow a naming convention that differs from Better Auth's defaults.

```typescript title="src/lib/auth.ts"
import { betterAuth } from "better-auth";
import { strapiAdapter } from "@strapi-community/plugin-better-auth";

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
  user: {
    modelId: "custom_user",
  },
  session: {
    modelId: "custom_session",
  },
  account: {
    modelId: "custom_account",
  },
  verification: {
    modelId: "custom_verification",
  },
});
```

After changing model IDs, re-run the schema generation command so Strapi picks up the new content type names:

```bash
npx auth generate
```

Refer to the [Better Auth schema documentation](https://www.better-auth.com/docs/concepts/database#change-table-name) for the full list of customisation options.

---

## Managed vs custom fields

Every field that Better Auth owns — like `email`, `emailVerified`, `token`, `userId`, and so on — is tagged with `"better-auth": { "managed": true }` in the Strapi content-type schema:

```json title="src/extensions/better-auth/content-types/user/schema.json (excerpt)"
"email": {
  "type": "email",
  "configurable": false,
  "pluginOptions": {
    "better-auth": { "managed": true }
  },
  "required": true,
  "unique": true
}
```

The plugin uses this flag to decide what it can touch during schema generation:

| Behaviour | Managed field | Custom field |
|-----------|--------------|--------------|
| Created by `npx auth generate` | ✅ | ❌ |
| Updated when Better Auth schema changes | ✅ | ❌ |
| Deleted when a plugin is disabled | ✅ | ❌ |
| Writable via Strapi Content-Type Builder | ❌ (`configurable: false`) | ✅ |

**You can add your own fields to any Better Auth content type** (for example, a `displayName` or `avatarUrl` on `ba_user`) through the Strapi admin panel or by editing the schema JSON directly. Because those fields do not carry the `managed` flag, the plugin will never touch or remove them.

:::caution
Do not manually add or edit managed fields. Any change you make will be overwritten the next time `npx auth generate` runs or the schema is regenerated.
:::
