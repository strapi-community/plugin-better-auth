import { AsyncLocalStorage } from "node:async_hooks";

/**
 * `strapi-plugin build` compiles the `.` (adapter) and `./strapi-server` (register.ts +
 * middlewares, which both pull in this file) exports as two independent bundles, each
 * getting its own copy of this module - so a plain module-level `AsyncLocalStorage`
 * wouldn't be shared between the adapter's calls and the middleware's check. Stashing the
 * single instance behind a global symbol keeps every copy of this file, in every bundle,
 * pointed at the same storage for the lifetime of the process.
 */
const STORAGE_KEY = Symbol.for(
  "@strapi-community/plugin-better-auth/internal-call-storage",
);

type GlobalWithStorage = typeof globalThis & {
  [STORAGE_KEY]?: AsyncLocalStorage<boolean>;
};

function getStorage(): AsyncLocalStorage<boolean> {
  const global = globalThis as GlobalWithStorage;

  if (!global[STORAGE_KEY]) {
    global[STORAGE_KEY] = new AsyncLocalStorage<boolean>();
  }

  return global[STORAGE_KEY];
}

/**
 * Marks every document service call made inside `fn` as coming from a trusted,
 * first-party caller (the Better Auth adapter itself, or another package of this
 * monorepo such as the dashboard's own admin tooling).
 *
 * `restrictDocumentService` checks this flag to let these calls through even
 * when direct document service writes to Better Auth's content types are
 * otherwise restricted, since business logic tied to those writes (e.g.
 * creating a complementary account for a new user) has already run - either
 * as part of the adapter call itself, or because the caller is trusted to
 * bypass it deliberately.
 *
 * @see restrictDocumentService in ../middlewares/restrict-document-service.ts
 */
export function runAsInternalCall<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(getStorage().run(true, fn));
}

/**
 * Whether the document service action currently being processed was initiated
 * through `runAsInternalCall`.
 */
export function isInternalCall(): boolean {
  return getStorage().getStore() === true;
}
