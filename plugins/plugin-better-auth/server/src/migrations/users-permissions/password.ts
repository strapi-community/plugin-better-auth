import { createAuthMiddleware } from "better-auth/api";

/**
 * Helpers for migrating `users-permissions` passwords to Better Auth.
 *
 * `users-permissions` hashes passwords with bcrypt, while Better Auth defaults
 * to scrypt. These helpers let existing bcrypt hashes keep working, and upgrade
 * them to scrypt the next time the user signs in.
 *
 * Wire them into your `auth.ts`:
 *
 * ```ts
 * import {
 *   usersPermissionsPasswordCompat,
 *   rehashBcryptOnSignIn,
 * } from "@strapi-community/plugin-better-auth/migration";
 *
 * export const auth = betterAuth({
 *   emailAndPassword: {
 *     enabled: true,
 *     password: usersPermissionsPasswordCompat(),
 *   },
 *   hooks: {
 *     after: rehashBcryptOnSignIn,
 *   },
 *   database: strapiAdapter(),
 * });
 * ```
 */

/** A bcrypt hash starts with the version prefix `$2a$`, `$2b$` or `$2y$`. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/**
 * A drop-in `emailAndPassword.password` config that verifies legacy bcrypt
 * hashes with bcrypt and everything else with Better Auth's default scrypt.
 * New passwords are hashed with scrypt, so the store converges on Better Auth's
 * default over time (see {@link rehashBcryptOnSignIn}).
 */
export function usersPermissionsPasswordCompat() {
  return {
    hash: async (password: string): Promise<string> => {
      const { hashPassword } = await import("better-auth/crypto");
      return hashPassword(password);
    },
    verify: async ({
      hash,
      password,
    }: {
      hash: string;
      password: string;
    }): Promise<boolean> => {
      if (isBcryptHash(hash)) {
        const bcrypt = await import("bcryptjs");
        return (bcrypt.default ?? bcrypt).compare(password, hash);
      }

      const { verifyPassword } = await import("better-auth/crypto");
      return verifyPassword({ hash, password });
    },
  };
}

/**
 * An `after` hook that, on a successful email/password sign-in, transparently
 * rehashes a legacy bcrypt credential to Better Auth's default (scrypt). It only
 * acts when the stored hash is still bcrypt, so it is a no-op once migrated.
 * Best-effort: any failure is swallowed so it never breaks a sign-in.
 */
export const rehashBcryptOnSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/email") return;

  // `newSession` is only set when the sign-in actually succeeded.
  const session = ctx.context.newSession;
  if (!session?.user?.id || !session.user.email) return;

  const password = (ctx.body as { password?: string } | undefined)?.password;
  if (!password) return;

  try {
    const result = await ctx.context.internalAdapter.findUserByEmail(
      session.user.email,
      { includeAccounts: true },
    );

    const credential = result?.accounts?.find(
      (account) => account.providerId === "credential",
    );

    if (!credential?.password || !isBcryptHash(credential.password)) return;

    const newHash = await ctx.context.password.hash(password);
    await ctx.context.internalAdapter.updatePassword(session.user.id, newHash);
  } catch {
    // Best-effort: leave the bcrypt hash in place and try again next sign-in.
  }
});
