---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): don't expose admin users through `/better-auth-dashboard/db`

The list route no longer populates or filters on relations to `admin::` content
types (such as the `createdBy`/`updatedBy` fields every content type has), which
returned the related admin user including their password hash. `populate` now
only accepts top-level relation fields; `*` and nested paths are ignored. This
only applies to logged-in Strapi admins; the public Content API is not affected.
