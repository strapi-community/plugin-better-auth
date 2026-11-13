import type { Core } from "@strapi/strapi";
import { PLUGIN_ID } from "../../utils";

const UP_USER_UID = "plugin::users-permissions.user";
const UP_ROLE_UID = "plugin::users-permissions.role";
const BA_USER_UID = "plugin::better-auth.user";
const BA_ACCOUNT_UID = "plugin::better-auth.account";
const AP_ROLE_UID = "plugin::api-permissions.role";

const STORE_KEY = "users-permissions-migration";
const PAGE_SIZE = 100;
const LOG_PREFIX = `[@strapi-community/${PLUGIN_ID}]`;

/** Scalar attribute types that are safe to copy verbatim from a U&P user. */
const SCALAR_TYPES = new Set([
  "string",
  "text",
  "richtext",
  "email",
  "integer",
  "biginteger",
  "float",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "time",
  "json",
  "enumeration",
  "uid",
]);

/** BA-user fields the migration sets itself, so they are never auto-copied. */
const RESERVED_USER_FIELDS = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "name",
  "email",
  "emailVerified",
  "image",
  "role",
  "roles",
  "banned",
  "banReason",
  "banExpires",
  "twoFactorEnabled",
]);

interface UpRole {
  id: number;
  name?: string;
  type?: string;
  description?: string;
  permissions?: Array<{ action?: string | null }>;
}

interface UpUser {
  id: number;
  username?: string;
  email?: string;
  provider?: string;
  password?: string;
  confirmed?: boolean;
  blocked?: boolean;
  role?: { id: number } | null;
  [key: string]: unknown;
}

interface ApRole {
  id: number;
  documentId: string;
  name?: string;
  type?: string;
}

interface PermissionsLayout {
  collectionTypes: { actions: Array<{ actionId: string; subjects: string[] }> };
  singleTypes: { actions: Array<{ actionId: string; subjects: string[] }> };
  plugins: Array<{ action: string }>;
}

interface ApPermissionService {
  getPermissionsLayout: () => PermissionsLayout;
  connectRolesToPermissions: (
    roleId: string,
    actions: string[],
  ) => Promise<unknown>;
}

export interface MigrationSummary {
  users: number;
  skippedUsers: number;
  credentialAccounts: number;
  oauthDeferred: number;
  failedUsers: number;
  rolesCreated: number;
  permissionsLinked: number;
  droppedActions: number;
}

type AnyQuery = ReturnType<Core.Strapi["db"]["query"]>;
type AnyDocuments = ReturnType<Core.Strapi["documents"]>;

const query = (strapi: Core.Strapi, uid: string): AnyQuery =>
  strapi.db.query(uid as Parameters<Core.Strapi["db"]["query"]>[0]);

const documents = (strapi: Core.Strapi, uid: string): AnyDocuments =>
  strapi.documents(uid as Parameters<Core.Strapi["documents"]>[0]);

const pluginStore = (strapi: Core.Strapi) =>
  strapi.store({ type: "plugin", name: PLUGIN_ID });

const isLocalUser = (user: UpUser): boolean =>
  !user.provider || user.provider === "local";

const slugifyType = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "role";

/** Whether this migration has already completed on a previous boot. */
export const hasCompletedMigration = async (
  strapi: Core.Strapi,
): Promise<boolean> => {
  const record = await pluginStore(strapi).get({ key: STORE_KEY });
  return Boolean(record);
};

/**
 * Builds the set of permission action strings (e.g. `api::article.article.find`)
 * that the API Permissions plugin actually knows about, so U&P permissions that
 * have no equivalent here (its own auth/plugin actions) can be dropped.
 */
const buildValidActionSet = (
  permissionService: ApPermissionService,
): Set<string> => {
  const layout = permissionService.getPermissionsLayout();
  const valid = new Set<string>();

  for (const group of [layout.collectionTypes, layout.singleTypes]) {
    for (const action of group.actions) {
      for (const subject of action.subjects) {
        valid.add(`${subject}.${action.actionId}`);
      }
    }
  }
  for (const plugin of layout.plugins) {
    valid.add(plugin.action);
  }

  return valid;
};

/**
 * Migrates users, credentials, role assignments and (best-effort) permissions
 * from the `users-permissions` plugin into Better Auth + API Permissions.
 *
 * Idempotent: users already present in Better Auth (matched by email) are
 * skipped, so a partial run can be retried safely. With `dryRun`, nothing is
 * written — it only logs what it would do.
 */
export const migrateFromUsersPermissions = async (
  strapi: Core.Strapi,
  options: { dryRun?: boolean } = {},
): Promise<MigrationSummary | null> => {
  const write = !options.dryRun;
  const mode = options.dryRun ? " (dry run)" : "";

  // Preflight: the Better Auth content types must have been generated already.
  if (!strapi.contentTypes[BA_USER_UID]) {
    strapi.log.error(
      `${LOG_PREFIX} Cannot migrate from users-permissions: the Better Auth content types ` +
        "do not exist yet. Run `npx auth generate` first, then boot again.",
    );
    return null;
  }

  // Roles and permissions can only be migrated when plugin-api-permissions is
  // installed (it owns their content types). Users and credentials don't need
  // it, so without it we migrate those and skip roles/permissions.
  const apPlugin = strapi.plugin("api-permissions");
  if (!apPlugin) {
    strapi.log.warn(
      `${LOG_PREFIX} plugin-api-permissions is not installed; migrating users and ` +
        "credentials only. Roles and permissions will not be migrated.",
    );
  }

  strapi.log.info(`${LOG_PREFIX} Migrating from users-permissions${mode}...`);

  const summary: MigrationSummary = {
    users: 0,
    skippedUsers: 0,
    credentialAccounts: 0,
    oauthDeferred: 0,
    failedUsers: 0,
    rolesCreated: 0,
    permissionsLinked: 0,
    droppedActions: 0,
  };

  // Map a U&P role id to its destination API Permissions role. Stays empty when
  // api-permissions isn't installed, so no roles get assigned to migrated users.
  const roleMap = new Map<number, ApRole | null>();

  if (apPlugin) {
    const permissionService = apPlugin.service(
      "permission",
    ) as unknown as ApPermissionService;
    const validActions = buildValidActionSet(permissionService);

    // --- 1. Resolve / create the destination API Permissions roles --------
    const apRoles = (await documents(strapi, AP_ROLE_UID).findMany(
      {},
    )) as ApRole[];
    const apRoleByType = new Map(
      apRoles.filter((r) => r.type).map((r) => [r.type, r]),
    );
    const apRoleByName = new Map(
      apRoles.filter((r) => r.name).map((r) => [r.name!.toLowerCase(), r]),
    );
    const usedTypes = new Set(
      apRoles.map((r) => r.type).filter(Boolean) as string[],
    );

    const upRoles = (await query(strapi, UP_ROLE_UID).findMany({
      populate: { permissions: true },
    })) as UpRole[];

    const createApRole = async (
      name: string,
      type: string,
      description?: string,
    ): Promise<ApRole | null> => {
      summary.rolesCreated++;
      if (!write) return null;

      const apRole = (await documents(strapi, AP_ROLE_UID).create({
        data: {
          name,
          description:
            description ?? `Migrated from users-permissions role "${name}".`,
          type,
        },
      })) as ApRole;
      apRoleByType.set(type, apRole);
      apRoleByName.set(name.toLowerCase(), apRole);
      usedTypes.add(type);
      return apRole;
    };

    for (const upRole of upRoles) {
      let apRole: ApRole | null = null;

      if (upRole.type === "public" || upRole.type === "authenticated") {
        // These are normally seeded by plugin-api-permissions, but seeding order
        // across plugins isn't guaranteed, so create them if they're missing.
        apRole = apRoleByType.get(upRole.type) ?? null;
        if (!apRole) {
          const name = upRole.type === "public" ? "Public" : "Authenticated";
          apRole = await createApRole(name, upRole.type, upRole.description);
        }
      } else if (upRole.name) {
        apRole = apRoleByName.get(upRole.name.toLowerCase()) ?? null;

        if (!apRole) {
          // Derive a unique `type` slug for the new role.
          let type = slugifyType(upRole.name);
          let suffix = 2;
          while (usedTypes.has(type)) {
            type = `${slugifyType(upRole.name)}-${suffix++}`;
          }
          apRole = await createApRole(upRole.name, type, upRole.description);
        }
      }

      roleMap.set(upRole.id, apRole);

      // --- 2. Best-effort permission translation (same action format) -----
      const actions = (upRole.permissions ?? [])
        .map((p) => p.action)
        .filter((a): a is string => typeof a === "string");
      const keep = actions.filter((a) => validActions.has(a));
      summary.droppedActions += actions.length - keep.length;

      if (write && apRole && keep.length > 0) {
        await permissionService.connectRolesToPermissions(
          apRole.documentId,
          keep,
        );
        summary.permissionsLinked += keep.length;
      } else if (!write) {
        summary.permissionsLinked += keep.length;
      }
    }
  }

  // --- 3. Migrate users + credentials -------------------------------------
  const userAttributes = strapi.contentTypes[BA_USER_UID].attributes as Record<
    string,
    { type?: string; pluginOptions?: { "better-auth"?: { managed?: boolean } } }
  >;
  const hasBanned = "banned" in userAttributes;
  const copyableFields = Object.entries(userAttributes)
    .filter(
      ([key, attr]) =>
        !RESERVED_USER_FIELDS.has(key) &&
        !attr.pluginOptions?.["better-auth"]?.managed &&
        SCALAR_TYPES.has(attr.type ?? ""),
    )
    .map(([key]) => key);

  const totalUsers = await query(strapi, UP_USER_UID).count();

  for (let offset = 0; offset < totalUsers; offset += PAGE_SIZE) {
    const upUsers = (await query(strapi, UP_USER_UID).findMany({
      populate: { role: true },
      offset,
      limit: PAGE_SIZE,
    })) as UpUser[];

    for (const upUser of upUsers) {
      const email = upUser.email?.trim();
      if (!email) {
        summary.skippedUsers++;
        continue;
      }

      try {
        const existing = await documents(strapi, BA_USER_UID).findFirst({
          filters: { email },
        });
        if (existing) {
          summary.skippedUsers++;
          continue;
        }

        const local = isLocalUser(upUser);
        const apRole = upUser.role ? roleMap.get(upUser.role.id) : null;

        const data: Record<string, unknown> = {
          name: upUser.username || email.split("@")[0],
          email,
          // OAuth accounts are implicitly verified so email account-linking works.
          emailVerified: Boolean(upUser.confirmed) || !local,
        };
        if (hasBanned) data.banned = Boolean(upUser.blocked);
        if (apRole) data.roles = { set: [apRole.documentId] };
        for (const field of copyableFields) {
          if (upUser[field] != null) data[field] = upUser[field];
        }

        summary.users++;

        if (local && upUser.password) {
          summary.credentialAccounts++;
        } else if (!local) {
          summary.oauthDeferred++;
        }

        if (!write) continue;

        const baUser = (await documents(strapi, BA_USER_UID).create({
          data,
        })) as {
          id: number;
        };

        if (local && upUser.password) {
          await documents(strapi, BA_ACCOUNT_UID).create({
            data: {
              accountId: String(baUser.id),
              providerId: "credential",
              userId: baUser.id,
              password: upUser.password,
            },
          });
        }
      } catch (error) {
        summary.failedUsers++;
        strapi.log.error(
          `${LOG_PREFIX} Failed to migrate user "${email}": ${(error as Error).message}`,
        );
      }
    }
  }

  // --- 4. Report + mark complete ------------------------------------------
  strapi.log.info(
    `${LOG_PREFIX} users-permissions migration${mode} complete: ` +
      `${summary.users} user(s), ${summary.credentialAccounts} credential account(s), ` +
      `${summary.oauthDeferred} OAuth user(s) deferred to re-link, ` +
      `${summary.skippedUsers} skipped, ${summary.failedUsers} failed, ` +
      `${summary.rolesCreated} role(s) created, ${summary.permissionsLinked} permission(s) linked ` +
      `(${summary.droppedActions} action(s) dropped).`,
  );

  if (write) {
    await pluginStore(strapi).set({
      key: STORE_KEY,
      value: { completedAt: new Date().toISOString(), summary },
    });
  } else {
    strapi.log.info(
      `${LOG_PREFIX} Dry run: nothing was written. Set migration.dryRun to false to apply.`,
    );
  }

  return summary;
};
