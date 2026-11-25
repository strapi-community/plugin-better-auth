---
"@strapi-community/plugin-better-auth-dashboard": patch
---

Fix the team members list in the organization detail view always showing as empty. The dashboard was sending a POST to the GET-only team members route, which returned a 403.
