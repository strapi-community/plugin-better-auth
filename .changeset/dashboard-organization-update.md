---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): save organization name and slug through Better Auth

The organization detail drawer wrote `name` and `slug` straight to the
database, so Better Auth's validation and organization hooks were skipped. They
now go through Better Auth's `dash()` organization update, the same way the user
drawer saves user fields. Changing an organization's slug to one that is
already taken now shows "Slug already exists" instead of a database error.

The logo is still saved directly, because Better Auth's update endpoint only
accepts absolute URLs and would reject media library paths such as
`/uploads/logo.png`.
