---
"@strapi-community/plugin-better-auth": patch
---

fix(adapter): keep every AND condition when several target the same field

The adapter merged Better Auth's AND conditions into one Strapi filter object, so
a second condition on the same field replaced the first. A range such as
`createdAt > start AND createdAt <= end` lost its lower bound and matched every
row up to `end`. This broke the dashboard's sign-up figures: in the sign-ups graph
(and the `better_auth_signups_graph` MCP tool) `newUsers` equalled the running
total, and the user stats compared each period with all earlier users instead of
the previous period. Several AND conditions now go in a `$and` filter.
