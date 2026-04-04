import type { BetterAuthOptions } from "better-auth";

type PasswordConfig = NonNullable<
  NonNullable<BetterAuthOptions["emailAndPassword"]>["password"]
>;

/**
 * Creates a password configuration for Better Auth that transparently supports
 * both **bcrypt** hashes (migrated from `users-permissions`) and **scrypt**
 * hashes (Better Auth's default for new passwords).
 *
 * After migrating users from `users-permissions` their passwords are stored as
 * bcrypt hashes (`$2b$…`). Without this helper, Better Auth's built-in scrypt
 * verifier will reject those hashes and migrated users will be unable to sign in.
 *
 * **How it works:**
 * - `hash()` — always produces a scrypt hash (Better Auth default).
 * - `verify()` — detects the hash format by its prefix:
 *   - `$2` prefix → bcrypt; verified via `bcryptjs.compare()`
 *   - anything else → scrypt; verified via Better Auth's `verifyPassword()`
 *
 * ⚠️  Passwords are **not** automatically re-hashed to scrypt on login.
 * Migrated users will continue to use bcrypt until you run a separate
 * re-hashing pass or they reset their password through your normal flow.
 *
 * `bcryptjs` is a transitive runtime dependency of `@strapi/admin`. No extra
 * installation is required.
 *
 * @example
 * ```ts
 * // apps/playground/config/better-auth.ts
 * import { createBcryptCompatiblePassword } from '@strapi-community/migrate-auth';
 *
 * export default betterAuth({
 *   emailAndPassword: {
 *     enabled: true,
 *     password: createBcryptCompatiblePassword(),
 *   },
 * });
 * ```
 */
export function createBcryptCompatiblePassword(): PasswordConfig {
  return {
    async hash(password: string): Promise<string> {
      const { hashPassword } = await import("better-auth/crypto");
      return hashPassword(password);
    },

    async verify({
      hash,
      password,
    }: {
      hash: string;
      password: string;
    }): Promise<boolean> {
      // Bcrypt hashes always start with "$2" (e.g. "$2b$10$…" or "$2a$10$…")
      if (hash.startsWith("$2")) {
        // bcryptjs is a transitive dep of @strapi/admin — always available at runtime
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
        return bcrypt.compare(password, hash);
      }

      // Better Auth scrypt format: "hexSalt:hexHash"
      const { verifyPassword } = await import("better-auth/crypto");
      return verifyPassword({ hash, password });
    },
  };
}
