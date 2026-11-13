---
"@strapi-community/plugin-better-auth-dashboard": patch
---

Fix relation custom fields not showing their value in the organization edit panel. The organization detail view fetched its record without populating relations, so relation custom fields rendered empty. It now populates relation fields from the schema, matching the user detail panel.
