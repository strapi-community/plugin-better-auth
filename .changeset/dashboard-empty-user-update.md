---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): saving a user when only custom fields changed

Saving a user where only custom fields changed (for example a relation such as
Roles) sent an empty update to Better Auth. `@better-auth/infra` 0.4 rejects
that with "No valid fields to update", so the save failed. The dashboard now
only updates the Better Auth user when one of its own fields changed.
