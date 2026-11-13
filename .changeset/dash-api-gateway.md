---
"@strapi-community/plugin-better-auth-dashboard": minor
---

Add an opt-in third-party HTTP gateway to the Better Auth `dash()` endpoints. When enabled via `dashApi: { enabled: true }` in the plugin config, the plugin mounts `/api/better-auth-dashboard/dash/*`, authenticated with a Strapi API token, and forwards each request through the same signed-JWT mechanism the dashboard uses (so Better Auth's own logic runs). This lets external services manage users and read analytics without the admin panel. Disabled by default — when off, the routes are not registered.
