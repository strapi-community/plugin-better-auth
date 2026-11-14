---
"@strapi-community/plugin-better-auth": minor
---

feat(adapter): support Better Auth's native string ids (and keep serial), both with cascade deletes

The adapter now works with Better Auth's native id strategy out of the box — no
`generateId` configuration required. Better Auth's application-generated id (its
default random string, or a UUID) is stored as Strapi's `document_id`; with
`generateId: "serial"` it is stored as Strapi's numeric `id` as before.

Both strategies now declare database foreign keys with `ON DELETE CASCADE`, so
Better Auth's cascade deletes work (removing a user clears its sessions and
accounts, removing an organization clears its members, and so on). In the
documentId case this is backed by a unique constraint the adapter puts on
`document_id`.

That unique constraint is also a single-row lock: Better Auth content types must
be exactly one row per document, so Draft & Publish and i18n localization (which
store multiple rows per document and would break cascade deletes) are rejected —
at boot with a clear error for those features, and at the database for any future
equivalent.
