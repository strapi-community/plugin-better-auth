---
"@strapi-community/plugin-better-auth-dashboard": minor
---

Show a "Passkeys" section in the user drawer's Security tab when the Better Auth `passkey()` plugin is configured. It lists each passkey (name, device type, backup state, creation date) with a delete action and an empty state. "Linked accounts" no longer implies that a passkey-only user has no way to sign in. Adds an admin-only `DELETE /better-auth-dashboard/db/:documentId` route that only deletes passkeys, and only one belonging to the given `userId`.
