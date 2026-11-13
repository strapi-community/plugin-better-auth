# @strapi-community/plugin-better-auth

## 1.0.1

### Patch Changes

- [#52](https://github.com/strapi-community/plugin-better-auth/pull/52) [`6d4b36c`](https://github.com/strapi-community/plugin-better-auth/commit/6d4b36c0fd094d52a4f0495d2bdc860b88f5378d) Thanks [@PaulBratslavsky](https://github.com/PaulBratslavsky)! - fix(adapter): keep every AND condition when several target the same field
  
  The adapter merged Better Auth's AND conditions into one Strapi filter object, so
  a second condition on the same field replaced the first. A range such as
  `createdAt > start AND createdAt <= end` lost its lower bound and matched every
  row up to `end`. This broke the dashboard's sign-up figures: in the sign-ups graph
  (and the `better_auth_signups_graph` MCP tool) `newUsers` equalled the running
  total, and the user stats compared each period with all earlier users instead of
  the previous period. Several AND conditions now go in a `$and` filter.

## 1.0.0

### Major Changes

- [#43](https://github.com/strapi-community/plugin-better-auth/pull/43) [`673372c`](https://github.com/strapi-community/plugin-better-auth/commit/673372ca2913acc79f2bc2265186a991431e55c0) Thanks [@boazpoolman](https://github.com/boazpoolman)! - ## First stable release 🎉
  _No changes since latest beta release._
