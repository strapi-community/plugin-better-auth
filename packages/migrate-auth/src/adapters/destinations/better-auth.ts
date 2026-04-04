import type { Core } from "@strapi/strapi";
import type { DestinationAdapter, MigratedUser, SourceUser } from "../types";

const USER_UID = "plugin::better-auth.user" as const;
const ACCOUNT_UID = "plugin::better-auth.account" as const;

/**
 * Destination adapter that writes users to the `plugin-better-auth` plugin.
 *
 * For each source user this adapter:
 * 1. Creates a `plugin::better-auth.user` record
 * 2. Creates a `plugin::better-auth.account` record linked to that user
 *    - credential users  → `providerId: "credential"`, password hash stored as-is
 *    - OAuth users       → `providerId: <provider>`, no password
 *
 * Note: bcrypt hashes migrated from users-permissions are stored verbatim.
 * To allow sign-in with those hashes after migration, configure Better Auth with
 * `createBcryptCompatiblePassword()` from this package.
 */
export class BetterAuthDestination implements DestinationAdapter {
  constructor(private readonly strapi: Core.Strapi) {
    if (!strapi.plugin("better-auth")) {
      throw new Error(
        "[@strapi-community/migrate-auth] The `better-auth` plugin is not installed. " +
          "Install @strapi-community/plugin-better-auth before running this migration.",
      );
    }
  }

  async userExists(email: string): Promise<boolean> {
    const user = await this.strapi.documents(USER_UID).findFirst({
      filters: { email },
    });
    return !!user;
  }

  async createUser(user: SourceUser): Promise<MigratedUser> {
    const created = await this.strapi.documents(USER_UID).create({
      data: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });

    return { id: created.id, documentId: created.documentId };
  }

  async createAccount(
    user: SourceUser,
    migratedUser: MigratedUser,
  ): Promise<void> {
    await this.strapi.documents(ACCOUNT_UID).create({
      data: {
        accountId: user.email,
        providerId: user.provider === "local" ? "credential" : user.provider,
        // numeric id — consistent with supportsNumericIds: true in the adapter
        userId: migratedUser.id,
        // carry the hash forward; null for OAuth accounts
        password: user.password ?? null,
      },
    });
  }
}
