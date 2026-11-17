---
"@strapi-community/plugin-better-auth-dashboard": patch
---

Fix the Overview page crashing with "Objects are not valid as a React child" when hovering a retention row. The Better Auth client parses the retention window dates into `Date` objects, which were passed straight into the hover text; they're now formatted as UTC dates.
