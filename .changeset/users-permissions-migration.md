---
"@strapi-community/plugin-better-auth": minor
---

feat: add a migration path from the users-permissions plugin

Adds a one-time, idempotent migration from Strapi's users-permissions plugin to Better Auth. Enabling the new `migration` plugin option relaxes the boot guard so both plugins can run together, and at bootstrap it migrates users and their bcrypt credentials into Better Auth's `user`/`account` content types, maps roles and (best-effort) permissions onto API Permissions when it's installed, and defers OAuth users to re-link by email. A new `@strapi-community/plugin-better-auth/migration` entry point exports `usersPermissionsPasswordCompat()` and `rehashBcryptOnSignIn`, so existing bcrypt passwords keep working and transparently upgrade to scrypt on the next successful sign-in. See the migration guide for the full cutover steps.
