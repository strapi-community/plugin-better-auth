# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A pnpm/Turborepo monorepo of three companion Strapi v5 plugins, developed against a shared Strapi
"playground" app:

| Package | Path | Purpose |
| ------- | ---- | ------- |
| `plugin-better-auth` | `plugins/plugin-better-auth` | Better Auth database adapter for Strapi (core) |
| `plugin-better-auth-dashboard` | `plugins/plugin-better-auth-dashboard` | Admin panel dashboard for Better Auth users/orgs/sessions |
| `plugin-api-permissions` | `plugins/plugin-api-permissions` | Auth-provider-agnostic Content API RBAC |
| `@strapi-community/dev-utils` | `packages/dev-utils` | Internal dev tooling (dev server, DB, Playwright/Vitest helpers), not published |

`apps/playground` is the Strapi app all three plugins run and are tested against. `apps/docs` is
the documentation site. All plugins are beta — not production-ready.

Requires Node.js >= 22 and pnpm >= 10.

## Commands

```bash
pnpm install              # install workspace deps
pnpm build                # turbo build, all packages (build order follows ^build deps)
pnpm dev                  # start playground against SQLite (default)
pnpm dev:postgres         # start playground against Postgres (spins up Docker automatically)
pnpm dev:mysql            # start playground against MySQL (spins up Docker automatically)
```

Linting/type-checking (Biome for lint, tsc for types — run per package via turbo):

```bash
pnpm lint                 # biome check --fix, all packages
pnpm lint:ts               # tsc --noEmit for both admin and server projects, all plugins
```

Testing:

```bash
pnpm test:integration               # vitest, SQLite, concurrency=1 across plugins
pnpm test:integration:postgres      # same, Postgres (Docker)
pnpm test:integration:mysql         # same, MySQL (Docker)

pnpm build                          # required first — e2e runs against built plugin dist
pnpm test:e2e                       # playwright, SQLite
pnpm test:e2e:postgres              # playwright, Postgres
pnpm test:e2e:mysql                 # playwright, MySQL
```

Run a single test by `cd`-ing into the plugin and invoking the runner directly:

```bash
cd plugins/plugin-better-auth
pnpm test:integration -- server/test/adapter.test.ts -t "test name"   # vitest run
DATABASE_CLIENT=sqlite with-db pnpm test:integration                  # if a DB is required and not already running

cd plugins/plugin-api-permissions   # or plugin-better-auth-dashboard
pnpm test:e2e -- admin/test/users.spec.ts                             # playwright test
```

`with-db` (from `dev-utils`) wraps a command with a Docker Postgres/MySQL service for the
requested `DATABASE_CLIENT`, exporting connection env vars, and tears the service down on exit.
Without an explicit `DATABASE_NAME`, each test process gets its own ephemeral DB
(`strapi_<PID>`), so parallel/individual test runs never collide; set `WITH_DB_SKIP_DOCKER=1` to
reuse an already-running database instead of spinning one up.

Integration tests use `setupStrapi`/`stopStrapi` from `@strapi-community/dev-utils` to boot the
playground app; e2e tests use `createPlaywrightConfig`/`registerAuthSetup` from the same package.
Both pick a free port per worker so parallel test files don't collide.

Pre-commit runs lint-staged (`pnpm lint` + `tsc --noEmit` on server sources) via husky.

## Architecture

### plugin-better-auth — the adapter

The core of this plugin is `server/src/adapter/adapter.ts`, a Better Auth
`createAdapterFactory` implementation that makes Strapi's Document Service the database backend
for Better Auth. Key mechanics:

- **Model → Strapi UID mapping**: Better Auth model names are resolved back to their original
  schema key via `getDefaultModelName` (so a renamed `modelName` doesn't change the UID), then
  kebab-cased into `plugin::better-auth.<model>` (see `getModelUid` in `adapter.ts`).
- **CRUD methods** (`create`/`update`/`updateMany`/`delete`/`deleteMany`/`findOne`/`findMany`/`count`)
  translate Better Auth's `where`/`sortBy`/`select` into Strapi filters/sort/field selections via
  `server/src/adapter/transformers/` (`filters.ts`, `sort.ts`, `output.ts`), then call
  `strapi.documents(uid)`.
- **Schema generation** (`createSchema`, invoked by `npx auth generate`) is the unusual part: it
  boots a *second*, throwaway Strapi app instance in-process (`adapter/cli/`, via
  `getStrapiApp`/`cleanupStrapiApp`/`cleanupDistDirectory`) purely to reach the
  content-type-builder service, then calls `updateStrapiSchema`
  (`transformers/schema/transformer.ts`) to create/update content-type JSON schemas on disk from
  Better Auth's table definitions. `transformers/schema/utils.ts` maps Better Auth field types to
  Strapi attribute types and derives naming conventions (UID, table/collection name with a
  configurable `table_prefix`, global ID, display name). It returns `true` to opt out of Better
  Auth's own file-writing (see the `@ts-expect-error` comment in `adapter.ts` — this is a
  documented workaround for a Better Auth bug/limitation).
- Better Auth content types are hidden from the Content Manager nav
  (`pluginOptions['content-manager'].visible = false`) except `user`; `bootstrap.ts` manually
  registers them as subjects on the `content-manager.explorer.*` actions and re-syncs Super Admin
  permissions so relation fields into these content types still resolve correctly.

**Request handling**: `auth-service.ts` locates and requires the user's Better Auth config
(an `auth.ts`/`auth.js` exporting `auth`, searched under app root and dist — see
`POSSIBLE_CONFIG_LOCATIONS`/`getPluginService` in `utils`). `auth-controller.ts` is a reverse
proxy: it converts the incoming Koa `ctx` into a Fetch `Request`, passes it to `auth.handler`,
and copies the Fetch `Response` back onto `ctx` (with special-cased `Set-Cookie` handling since
joining multiple cookies with `, ` breaks date parsing). `register.ts` mounts these routes at
Better Auth's configured `basePath` (stripped of the API prefix to avoid doubling it) and, if
`plugin-api-permissions` is installed, registers a session resolver with it that calls
`auth.api.getSession` and loads the matching Strapi user + roles. It throws at boot if no Better
Auth config is found, or if `users-permissions` is also installed (mutually exclusive).

### plugin-api-permissions — Content API RBAC

Auth-provider agnostic: it exposes a `session` service with `registerSessionResolver(fn)`, where
`fn(ctx)` returns `{ user, roles }` or `null`. A `content-api` authentication strategy
(`strategies/content-api.ts`) runs on every Content API request, calls the registered resolver,
loads permissions for the resolved role(s) (falling back to the **Public** role when
unauthenticated), and builds a CASL ability attached to the request. `role`/`permission` content
types back a Roles admin UI (Settings → API Permissions → Roles); **Public** and **Authenticated**
roles are seeded on first boot, and users are reassigned to Public when their role is deleted
(`middlewares/reassign-orphaned-users.ts`). `plugin-better-auth`'s `register.ts` auto-registers
its session resolver with this plugin when both are installed; otherwise a resolver must be wired
manually and `user_uid` set in plugin config.

### plugin-better-auth-dashboard — admin UI

Depends on the Better Auth `dash()` plugin from `@better-auth/infra` plus the `jwt()` plugin being
configured in the user's `auth.ts`, and only works with Better Auth's default `basePath`
(`/api/auth`). It reads user/session/organization data through that infra rather than talking to
Strapi's content types directly. Feature panels (ban, 2FA, email verification, organizations)
detect and adapt to whichever Better Auth plugins are actually configured.

### Build/type system

Each plugin builds via `strapi-plugin build`/`watch`/`verify` (from `@strapi/sdk-plugin`), with
separate `server` and `admin` TypeScript projects (`tsconfig.json`/`tsconfig.build.json` in each),
each with its own `lint:ts:server`/`lint:ts:admin` script. `plugin-better-auth` has no `admin`
package — it's server-only. Package `exports` maps `./strapi-server`/`./strapi-admin` to built
output for Strapi's plugin loader, and `plugin-better-auth` additionally exports `.` (the adapter
itself) for direct import as `strapiAdapter` in a consumer's `auth.ts`.
