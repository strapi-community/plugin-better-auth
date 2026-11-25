---
"@strapi-community/plugin-better-auth-dashboard": patch
---

Fix organization invitations failing with a 401. Dashboard users are Strapi admins rather than Better Auth users, so the invite form now has an "Invite as" field that picks the organization owner or admin the invitation is sent on behalf of. It defaults to the owner. Cancelling and resending invitations also failed with a 401 for the same reason (the invitation id was missing from the signed dash token) and now work.
