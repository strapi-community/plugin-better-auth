---
"@strapi-community/plugin-better-auth": minor
---

feat(adapter): support case-insensitive filtering

Honour Better Auth's `mode: "insensitive"` on where conditions by mapping to
Strapi's case-insensitive operators (`$eqi`, `$nei`, `$containsi`, `$startsWithi`,
`$endsWithi`). `in`/`not_in` have no case-insensitive Strapi operator, so they are
expanded into an `$or`/`$and` group of `$eqi`/`$nei` conditions.
