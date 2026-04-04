import type { Core } from "@strapi/strapi";
import type { SourceAdapter, SourceUser } from "../types";

const UID = "plugin::users-permissions.user" as const;

/**
 * Source adapter that reads users from Strapi's built-in `users-permissions` plugin.
 *
 * Field mapping:
 * - `username`  → `name`
 * - `email`     → `email`
 * - `confirmed` → `emailVerified`
 * - `password`  → `password`  (bcrypt hash, local users only)
 * - `provider`  → `provider`
 * - `role`      → `role`      (populated relation)
 */
export class UsersPermissionsSource implements SourceAdapter {
  constructor(private readonly strapi: Core.Strapi) {
    if (!strapi.plugin("users-permissions")) {
      throw new Error(
        "[@strapi-community/migrate-auth] The `users-permissions` plugin is not installed. " +
          "Install @strapi/plugin-users-permissions before running this migration.",
      );
    }
  }

  async getUserCount(): Promise<number> {
    return this.strapi.db.query(UID).count({});
  }

  async getUsers(options: {
    limit: number;
    offset: number;
  }): Promise<SourceUser[]> {
    const users = await this.strapi.db.query(UID).findMany({
      where: {},
      limit: options.limit,
      offset: options.offset,
      populate: ["role"],
    });

    return (users as RawUpUser[]).map((user) => ({
      email: user.email,
      // users-permissions has `username` rather than a separate `name` field
      name: user.username || user.email.split("@")[0],
      emailVerified: user.confirmed ?? false,
      // Only carry the hash for credential (local) users
      password:
        user.provider === "local" && user.password ? user.password : undefined,
      provider: user.provider ?? "local",
      role: user.role
        ? {
            name: user.role.name,
            description: user.role.description ?? undefined,
          }
        : undefined,
    }));
  }
}

// Minimal shape of the raw record returned by strapi.db.query for users-permissions
interface RawUpUser {
  id: number;
  username: string;
  email: string;
  provider: string;
  password: string | null;
  confirmed: boolean;
  blocked: boolean;
  role?: {
    id: number;
    name: string;
    description?: string | null;
    type?: string;
  } | null;
}
