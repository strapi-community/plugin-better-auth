# playground-serial

A copy of [`apps/playground`](../playground) that runs Better Auth with **serial
(numeric) ids** (`advanced.database.generateId: "serial"`), so the plugins'
E2E suites can be run against both id strategies:

| App | Id strategy | Better Auth id stored as | Foreign keys |
| --- | --- | --- | --- |
| `apps/playground` | native (default) | string `document_id` | string → `document_id` |
| `apps/playground-serial` | serial | numeric `id` | integer → `id` |

Only `src/lib/auth.ts` and the generated Better Auth content-type schemas
(`src/extensions/better-auth/content-types/*/schema.json`) differ from
`apps/playground`. **Keep everything else in sync with `apps/playground`.**

After changing the Better Auth config, regenerate the schemas from this
directory (with the plugins built: `pnpm build` at the repo root):

```bash
npx auth generate
```

## Usage

From the repo root:

```bash
pnpm dev:serial                  # SQLite
pnpm dev:serial:postgres         # Postgres (Docker)
pnpm dev:serial:mysql            # MySQL (Docker)

pnpm test:e2e:serial             # E2E suites against this app, SQLite
pnpm test:e2e:serial:postgres
pnpm test:e2e:serial:mysql
```

Under the hood these set `PLAYGROUND=playground-serial`, which the
`@strapi-community/dev-utils` Playwright config uses to pick the app to boot.
