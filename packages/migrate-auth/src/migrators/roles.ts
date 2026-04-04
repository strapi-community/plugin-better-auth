import type { Core } from "@strapi/strapi";
import type { RoleMigrationReport } from "../adapters/types";

const UP_USER_UID = "plugin::users-permissions.user" as const;
const UP_ROLE_UID = "plugin::users-permissions.role" as const;
const API_ROLE_UID = "plugin::api-permissions.role" as const;
const BA_USER_UID = "plugin::better-auth.user" as const;

/**
 * Migrates roles from `users-permissions` to `api-permissions` and re-assigns
 * already-migrated Better Auth users to their corresponding new roles.
 *
 * Role migration is intentionally static — roles always flow from
 * `users-permissions` → `api-permissions`. If a matching role (by name) already
 * exists in `api-permissions` it is reused rather than duplicated.
 *
 * Run this after `migrateUsers()` so that Better Auth users exist and can be
 * connected to their roles.
 *
 * @example
 * ```ts
 * const report = await migrateRoles(strapi);
 * console.log(report);
 * ```
 */
export async function migrateRoles(
  strapi: Core.Strapi,
  options: { dryRun?: boolean } = {},
): Promise<RoleMigrationReport> {
  const { dryRun = false } = options;

  if (!strapi.plugin("users-permissions")) {
    throw new Error(
      "[@strapi-community/migrate-auth] The `users-permissions` plugin is not installed.",
    );
  }
  if (!strapi.plugin("api-permissions")) {
    throw new Error(
      "[@strapi-community/migrate-auth] The `api-permissions` plugin is not installed.",
    );
  }
  if (!strapi.plugin("better-auth")) {
    throw new Error(
      "[@strapi-community/migrate-auth] The `better-auth` plugin is not installed.",
    );
  }

  const report: RoleMigrationReport = {
    total: 0,
    created: 0,
    skipped: 0,
    assigned: 0,
    errors: [],
  };

  // -----------------------------------------------------------------------
  // Step 1: build a mapping from users-permissions role id → api-permissions
  // role documentId, creating roles as needed.
  // -----------------------------------------------------------------------
  const upRoles = (await strapi.db
    .query(UP_ROLE_UID)
    .findMany({})) as RawUpRole[];

  report.total = upRoles.length;

  // Cache: upRole.id → { documentId }
  const roleMap = new Map<number, { documentId: string }>();

  for (const upRole of upRoles) {
    try {
      const existing = await strapi.documents(API_ROLE_UID).findFirst({
        filters: { name: upRole.name },
      });

      if (existing) {
        roleMap.set(upRole.id, { documentId: existing.documentId });
        report.skipped++;
      } else if (!dryRun) {
        const created = await strapi.documents(API_ROLE_UID).create({
          data: {
            name: upRole.name,
            description: upRole.description ?? "",
          },
        });
        roleMap.set(upRole.id, { documentId: created.documentId });
        report.created++;
      } else {
        // dry-run placeholder so role assignment logic can still run
        roleMap.set(upRole.id, { documentId: `dry-run-${upRole.id}` });
        report.created++;
      }
    } catch (err) {
      report.errors.push({
        name: upRole.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: for every users-permissions user, connect the corresponding
  // Better Auth user to the mapped api-permissions role.
  // -----------------------------------------------------------------------
  const upUsers = (await strapi.db.query(UP_USER_UID).findMany({
    where: {},
    populate: ["role"],
  })) as RawUpUser[];

  for (const upUser of upUsers) {
    if (!upUser.role) continue;

    const apiRole = roleMap.get(upUser.role.id);
    if (!apiRole) continue;

    try {
      const baUser = await strapi.documents(BA_USER_UID).findFirst({
        filters: { email: upUser.email },
      });

      if (!baUser) continue;

      if (!dryRun) {
        await strapi.documents(BA_USER_UID).update({
          documentId: baUser.documentId,
          // `roles` is a dynamic manyToMany relation injected at runtime by api-permissions
          data: {
            roles: { connect: [{ documentId: apiRole.documentId }] },
          } as never,
        });
      }

      report.assigned++;
    } catch (err) {
      report.errors.push({
        name: upUser.email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Internal raw types for the db.query results
// ---------------------------------------------------------------------------

interface RawUpRole {
  id: number;
  name: string;
  description?: string | null;
  type?: string;
}

interface RawUpUser {
  id: number;
  email: string;
  role?: RawUpRole | null;
}
