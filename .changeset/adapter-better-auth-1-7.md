---
"@strapi-community/plugin-better-auth": minor
---

feat(adapter): support Better Auth 1.7 with native `consumeOne` and `incrementOne`

Better Auth 1.7 uses two new adapter methods, `consumeOne` and `incrementOne`,
for single-use verification tokens (password reset, email verification, magic
links, OTPs), 2FA attempt counters, the database rate limiter and organization
member/team counts. The adapter now implements both natively. Each one locks
the matching row in a database transaction, so concurrent requests can't
consume the same token twice, lose a counter update or get past a limit.
Without them, Better Auth's built-in fallback failed on this adapter, which
broke password reset and other single-use tokens.

Also for 1.7:

- `update` now returns `null` when no record matches, instead of throwing.
- `updateMany` and `deleteMany` now return the number of records they actually
  changed.
