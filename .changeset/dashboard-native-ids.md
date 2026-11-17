---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): support Better Auth's native (string) ids

The user and organization detail views assumed a Better Auth id was Strapi's
numeric `id`, which only holds with `generateId: "serial"`. With Better Auth's
native ids — now the adapter's default — they failed to load or save:

- Lookups of the Strapi entry behind a user or organization filtered the numeric
  `id` column with a string id and found nothing (and errored on Postgres). They
  now resolve the id against `documentId` whenever Better Auth ids aren't serial.
- Organization requests put the id in the URL path, where the Better Auth client
  kebab-cases it (`LRM9…` → `-l-r-m9…`), so the organization was "not found". The
  id is now passed as a path parameter, which is left untouched.

Serial ids keep working as before.
