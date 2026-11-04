# Contributing to Strapi + Better Auth

Thank you for your interest in contributing! Contributions of all kinds — bug reports, feature ideas, documentation improvements, and code — are welcome.

## Getting started

### Prerequisites

- Node.js >= 22
- pnpm >= 10

### Setup

```bash
git clone https://github.com/strapi-community/plugin-better-auth.git
cd plugin-better-auth
pnpm install
pnpm build
pnpm dev
```

### Dev commands

All dev commands start the playground Strapi app. Postgres and MySQL variants start the required Docker service automatically.

```bash
pnpm dev                  # SQLite (default)
pnpm dev:postgres         # Postgres
pnpm dev:mysql            # MySQL
```

See [`packages/dev-utils`](./packages/dev-utils/README.md) for details on `dev-strapi` and `with-db`.

## Project structure

```
plugins/
  plugin-better-auth/           # Better Auth database adapter for Strapi
  plugin-better-auth-dashboard/ # Admin panel dashboard for Better Auth users
  plugin-api-permissions/       # Content API RBAC (roles & permissions)
packages/
  dev-utils/                    # Dev tooling: test helpers, dev server, Docker
apps/
  playground/                   # Development Strapi app
  docs/                         # Documentation site
```

## Making changes

1. Fork the repository and create a branch from `main`.
2. Make your changes in the relevant plugin under `plugins/`.
3. Add or update tests where appropriate.
4. Run the checks below before opening a pull request.

### Checks

```bash
# Linting
pnpm lint

# Type checking
pnpm lint:ts

# Integration tests
pnpm test:integration
pnpm test:integration:postgres
pnpm test:integration:mysql

# E2e tests — requires a build first
pnpm build
pnpm test:e2e
pnpm test:e2e:postgres
pnpm test:e2e:mysql
```

### Changesets

Releases are managed with [Changesets](https://github.com/changesets/changesets). If your change affects a published plugin, add a changeset describing it:

```bash
pnpm changeset
```

## Pull requests

- Keep pull requests focused on a single concern.
- Describe *why* the change is needed, not just what it does.
- Reference any related issues with `Fixes #123` or `Closes #123`.
- All checks must pass before a PR can be merged.

## Reporting issues

Use the [GitHub issue tracker](https://github.com/strapi-community/plugin-better-auth/issues). Please search for an existing issue before opening a new one, and include:

- A clear description of the problem.
- Steps to reproduce it.
- The versions of Node.js, pnpm, and Strapi you are using.

## Code style

This project uses [Biome](https://biomejs.dev/) for formatting and linting. Run `pnpm lint` to auto-fix issues before committing.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE.md).
