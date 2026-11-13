import type { AuthMiddleware } from "better-auth/api";

/**
 * Type declarations for `@strapi-community/plugin-better-auth/migration`.
 *
 * Hand-authored because the plugin build tooling only emits a bundled `.d.ts`
 * for the package's root export. Keep in sync with
 * `server/src/migrations/users-permissions/password.ts`.
 */

/** A bcrypt hash starts with the version prefix `$2a$`, `$2b$` or `$2y$`. */
export declare function isBcryptHash(hash: string): boolean;

/**
 * A drop-in `emailAndPassword.password` config that verifies legacy bcrypt
 * hashes with bcrypt and everything else with Better Auth's default scrypt.
 */
export declare function usersPermissionsPasswordCompat(): {
  hash: (password: string) => Promise<string>;
  verify: (args: { hash: string; password: string }) => Promise<boolean>;
};

/**
 * An `after` hook that rehashes a legacy bcrypt credential to Better Auth's
 * default (scrypt) on the next successful email/password sign-in.
 */
export declare const rehashBcryptOnSignIn: AuthMiddleware;
