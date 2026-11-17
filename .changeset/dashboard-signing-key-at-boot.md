---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): create the JWT signing key at startup

On a fresh database the dashboard could stop working for up to 15 minutes, with
every request rejected (`ERR_JWKS_NO_MATCHING_KEY` in the server log). Better
Auth's `jwt()` plugin creates its signing key on first use, without a lock, so
the dashboard's first burst of concurrent requests could each create one. The
`dash()` plugin caches the key set it fetches for 15 minutes, so tokens signed
with a key created after that snapshot all failed verification.

The plugin now creates the signing key once at startup, before any request is
served.
