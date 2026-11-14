---
"@strapi-community/plugin-better-auth": patch
---

fix(adapter): require `generateId: "serial"` and fail fast otherwise

The adapter stores records using Strapi's numeric id and relies on integer
foreign keys with `ON DELETE CASCADE`, which Better Auth needs for its cascade
deletes (removing a user clears their sessions and accounts, and so on). Other id
strategies (UUID, the default random string, custom generators) silently broke
relations and cascades, so the adapter now throws a clear error at startup when
`advanced.database.generateId` is not `"serial"`.
