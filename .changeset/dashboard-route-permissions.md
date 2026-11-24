---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): match admin route permissions to the admin panel

Some of the dashboard's admin API routes didn't fully check the admin's
dashboard permissions, so an authenticated admin could call them without the
permission the admin panel requires for the same action. This only applies to
logged-in Strapi admins; the public Content API is not affected.

Each route now requires the same dashboard permission as the matching action in
the admin panel, and anything the panel doesn't do is denied:

- Overview → `Overview: Read`; user and organization lists → `Read`;
  create dialogs → `Create`; deletes → `Delete`; the detail drawers and every
  action inside them → `Update`.
- `dash()` endpoints the dashboard doesn't use (such as `execute-adapter`,
  `impersonate-user` and `export-users`) can't be called through the admin
  route.
- `/better-auth-dashboard/db` only serves the Better Auth `user`, `session`,
  `passkey` and `organization` content types, and never `admin::` content
  types. Searching a custom relation field's target content type requires
  Content Manager read access to it, the same as in the Content Manager.

If an admin role used the dashboard without the matching permission, grant it
under Settings → Roles → Plugins → Better Auth Dashboard.
