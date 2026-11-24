---
"@strapi-community/plugin-better-auth-dashboard": minor
---

Make `createdAt` and `updatedAt` editable in the user and organization detail drawers. The dashboard db route now writes these timestamps straight to the table, since Strapi's document service would otherwise reset `updatedAt` to the current time on every update.
