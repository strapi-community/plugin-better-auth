---
"@strapi-community/plugin-better-auth": minor
---

feat(adapter): resolve Better Auth joins natively

When `experimental.joins` is enabled, Better Auth delegates joins to the adapter
instead of emulating them with extra round-trips. The adapter now resolves each
requested join against Strapi's document service — matching `on.from`/`on.to`,
honouring one-to-one vs one-to-many and the per-join limit — and attaches the
related rows so Better Auth's output transformer can read them back.
