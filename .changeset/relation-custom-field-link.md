---
"@strapi-community/plugin-better-auth-dashboard": patch
---

fix(dashboard): link relation custom field values to their Content Manager item

Relation custom fields in the user and organization edit panels now render each
assigned value as a link to that item's Content Manager edit view, instead of
plain text. The target's content-type kind is resolved so single types and
collection types get the correct route.
