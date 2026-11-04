# Strapi + Better Auth

A [Better Auth](https://better-auth.com) database adapter that uses [Strapi](https://strapi.io) as the database backend. This package allows you to integrate Better Auth's authentication system with your Strapi application seamlessly.

## Features

- ✅ Full Better Auth database adapter implementation
- ✅ Uses Strapi's document service for data management
- ✅ Supports all Better Auth core features (users, sessions, accounts, verification)
- ✅ All Better Auth endpoints available through Strapi API
- ✅ Works with Strapi v5+

## Installation

_You need to be running **Strapi 5.45.0** or higher to use this plugin._

```bash
npm install better-auth @strapi-community/plugin-better-auth
# or
yarn add better-auth @strapi-community/plugin-better-auth
# or
pnpm add better-auth @strapi-community/plugin-better-auth
```

## Usage

### 1. Create a Better Auth config file

Create the Better Auth config file and add the following content.

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { strapiAdapter } from '@strapi-community/plugin-better-auth';

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
  advanced: {
    database: {
      generateId: 'serial',
    },
  },
});
```

### 2. Generate the content types

Run the content type generation command to bootstrap the default content types.

```bash
npx auth generate
```

_Tip: Every time you install a new Better Auth plugin, you have to run this command again._

### 3. Client implementation

Call the Better Auth API from your front-end:

```typescript
// In your React/Vue/Svelte app
import { createAuthClient } from 'better-auth/react'; // or /vue, /svelte

const authClient = createAuthClient({
  baseURL: 'http://localhost:1337/api/auth',
});

// Sign up
await authClient.signUp.email({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe',
});
```

### 4. Server side authentication

Use the Better Auth session to authenticate your users in custom Strapi controllers.

```typescript
import { auth } from '@/lib/auth.ts';

// In a Strapi controller
export default {
  async customMethod(ctx) {
    // Use Better Auth API methods
    const session = await auth.api.getSession({
      headers: ctx.request.headers,
    });
    
    if (session) {
      // User is authenticated
      console.log('User:', session.user);
    }
  }
}
```

## Supported plugins

Any Better Auth plugin may be used with Strapi + Better Auth. Some plugins require you to run the `generate` CLI in order to make the required schema changes. To do that you have to manually specify the location of the Better Auth config file.

```bash
npx auth generate
```

## Resources

- [Plugin Documentation](https://strapi-community.github.io/plugin-better-auth/)
- [Better Auth Documentation](https://better-auth.com)
- [Better Auth Database Adapters](https://better-auth.com/docs/concepts/database)
- [Creating Custom Adapters](https://better-auth.com/docs/guides/create-a-db-adapter)
- [Strapi Documentation](https://docs.strapi.io)

## Authors

- [Boaz Poolman](https://github.com/boazpoolman)
- [Marco Autiero](https://github.com/maccomaccomaccomacco)

## License

See the [LICENSE](./LICENSE.md) file for licensing information.
