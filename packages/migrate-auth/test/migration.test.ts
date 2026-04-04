import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  BetterAuthDestination,
  UsersPermissionsSource,
  migrateRoles,
  migrateUsers,
} from "../src";
import { setupStrapi, stopStrapi } from "./utils";

const UP_USER_UID = "plugin::users-permissions.user";
const UP_ROLE_UID = "plugin::users-permissions.role";
const BA_USER_UID = "plugin::better-auth.user";
const BA_ACCOUNT_UID = "plugin::better-auth.account";
const API_ROLE_UID = "plugin::api-permissions.role";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupStrapi();
});

afterAll(async () => {
  await stopStrapi();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A known bcrypt hash for the plain-text password "password" */
const BCRYPT_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

async function createUpUser(data: {
  username: string;
  email: string;
  password?: string | null;
  provider?: string;
  confirmed?: boolean;
  roleId?: number;
}) {
  return strapi.db.query(UP_USER_UID).create({
    data: {
      username: data.username,
      email: data.email,
      password: data.password !== undefined ? data.password : BCRYPT_HASH,
      provider: data.provider ?? "local",
      confirmed: data.confirmed ?? true,
      blocked: false,
      ...(data.roleId != null && { role: data.roleId }),
    },
  });
}

async function cleanupUpUsers() {
  const users = (await strapi.db
    .query(UP_USER_UID)
    .findMany({})) as Array<{ id: number }>;
  for (const user of users) {
    await strapi.db.query(UP_USER_UID).delete({ where: { id: user.id } });
  }
}

async function cleanupBetterAuth() {
  const accounts = await strapi.documents(BA_ACCOUNT_UID).findMany({});
  for (const acc of accounts) {
    await strapi
      .documents(BA_ACCOUNT_UID)
      .delete({ documentId: acc.documentId });
  }

  const users = await strapi.documents(BA_USER_UID).findMany({});
  for (const user of users) {
    await strapi.documents(BA_USER_UID).delete({ documentId: user.documentId });
  }
}

function makeAdapters() {
  return {
    source: new UsersPermissionsSource(strapi),
    destination: new BetterAuthDestination(strapi),
  };
}

// ---------------------------------------------------------------------------
// migrateUsers
// ---------------------------------------------------------------------------

describe("migrateUsers", () => {
  afterEach(async () => {
    await cleanupBetterAuth();
    await cleanupUpUsers();
  });

  it("dry-run: returns accurate total without writing any records", async () => {
    await createUpUser({ username: "alice", email: "alice@example.com" });
    await createUpUser({ username: "bob", email: "bob@example.com" });

    const { source, destination } = makeAdapters();
    const report = await migrateUsers({ source, destination, dryRun: true });

    expect(report.total).toBe(2);
    expect(report.migrated).toBe(0);
    expect(report.errors).toHaveLength(0);

    const baUsers = await strapi.documents(BA_USER_UID).findMany({});
    expect(baUsers).toHaveLength(0);
  });

  it("migrates a local user and creates a credential account", async () => {
    await createUpUser({
      username: "alice",
      email: "alice@example.com",
      confirmed: true,
    });

    const { source, destination } = makeAdapters();
    const report = await migrateUsers({ source, destination });

    expect(report.migrated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.errors).toHaveLength(0);

    const baUsers = await strapi.documents(BA_USER_UID).findMany({});
    expect(baUsers).toHaveLength(1);
    expect(baUsers[0].email).toBe("alice@example.com");
    expect(baUsers[0].name).toBe("alice");
    expect(baUsers[0].emailVerified).toBe(true);

    const accounts = await strapi.documents(BA_ACCOUNT_UID).findMany({});
    expect(accounts).toHaveLength(1);
    expect(accounts[0].providerId).toBe("credential");
    expect(accounts[0].accountId).toBe("alice@example.com");
    expect(accounts[0].password).toBe(BCRYPT_HASH);
  });

  it("migrates an unconfirmed user with emailVerified = false", async () => {
    await createUpUser({
      username: "unverified",
      email: "unverified@example.com",
      confirmed: false,
    });

    const { source, destination } = makeAdapters();
    await migrateUsers({ source, destination });

    const baUser = await strapi
      .documents(BA_USER_UID)
      .findFirst({ filters: { email: "unverified@example.com" } });

    expect(baUser?.emailVerified).toBe(false);
  });

  it("migrates an OAuth user with the correct providerId and no password", async () => {
    await createUpUser({
      username: "charlie",
      email: "charlie@example.com",
      provider: "google",
      password: null,
    });

    const { source, destination } = makeAdapters();
    const report = await migrateUsers({ source, destination });

    expect(report.migrated).toBe(1);

    const accounts = await strapi.documents(BA_ACCOUNT_UID).findMany({});
    expect(accounts).toHaveLength(1);
    expect(accounts[0].providerId).toBe("google");
    expect(accounts[0].password).toBeNull();
  });

  it("skips already-migrated users when skipExisting is true (default)", async () => {
    await createUpUser({ username: "alice", email: "alice@example.com" });

    const { source, destination } = makeAdapters();

    // First run
    const first = await migrateUsers({ source, destination });
    expect(first.migrated).toBe(1);

    // Second run — should skip
    const second = await migrateUsers({ source, destination });
    expect(second.skipped).toBe(1);
    expect(second.migrated).toBe(0);

    // Only one user should exist
    const baUsers = await strapi.documents(BA_USER_UID).findMany({});
    expect(baUsers).toHaveLength(1);
  });

  it("dry-run with skipExisting: accurately counts would-be skips", async () => {
    await createUpUser({ username: "alice", email: "alice@example.com" });
    await createUpUser({ username: "bob", email: "bob@example.com" });

    const { source, destination } = makeAdapters();

    // Migrate only alice
    await migrateUsers({
      source,
      destination,
      skipExisting: false,
      batchSize: 1,
    });
    // Remove bob from BA so alice is the only existing one
    const bobBA = await strapi
      .documents(BA_USER_UID)
      .findFirst({ filters: { email: "bob@example.com" } });
    if (bobBA) {
      const bobAccounts = await strapi
        .documents(BA_ACCOUNT_UID)
        .findMany({ filters: { userId: bobBA.id } });
      for (const acc of bobAccounts) {
        await strapi
          .documents(BA_ACCOUNT_UID)
          .delete({ documentId: acc.documentId });
      }
      await strapi
        .documents(BA_USER_UID)
        .delete({ documentId: bobBA.documentId });
    }

    const report = await migrateUsers({
      source,
      destination,
      dryRun: true,
      skipExisting: true,
    });

    expect(report.total).toBe(2);
    expect(report.skipped).toBe(1); // alice already exists
    expect(report.migrated).toBe(0); // dry-run
  });
});

// ---------------------------------------------------------------------------
// migrateRoles
// ---------------------------------------------------------------------------

describe("migrateRoles", () => {
  afterEach(async () => {
    await cleanupBetterAuth();
    await cleanupUpUsers();
  });

  it("creates a new api-permissions role for each users-permissions role", async () => {
    const upRole = (await strapi.db.query(UP_ROLE_UID).create({
      data: { name: "Editor", description: "Content editors", type: "editor" },
    })) as { id: number };

    // Seed a user with that role
    await createUpUser({
      username: "alice",
      email: "alice@example.com",
      roleId: upRole.id,
    });

    // Migrate users first so there is a BA user to assign the role to
    const { source, destination } = makeAdapters();
    await migrateUsers({ source, destination });

    const report = await migrateRoles(strapi);

    // "Editor" should now exist in api-permissions
    const apiRole = await strapi
      .documents(API_ROLE_UID)
      .findFirst({ filters: { name: "Editor" } });

    expect(apiRole).toBeTruthy();
    expect(report.created).toBeGreaterThanOrEqual(1);
    expect(report.assigned).toBeGreaterThanOrEqual(1);
    expect(report.errors).toHaveLength(0);

    // Cleanup
    if (apiRole) {
      await strapi
        .documents(API_ROLE_UID)
        .delete({ documentId: apiRole.documentId });
    }
    await strapi.db
      .query(UP_ROLE_UID)
      .delete({ where: { id: upRole.id } });
  });

  it("skips creating a role that already exists in api-permissions", async () => {
    // Pre-create the role in api-permissions
    const existing = await strapi.documents(API_ROLE_UID).create({
      data: { name: "Reviewer", description: "Pre-existing" },
    });

    const upRole = (await strapi.db.query(UP_ROLE_UID).create({
      data: { name: "Reviewer", description: "Reviewers", type: "reviewer" },
    })) as { id: number };

    await createUpUser({
      username: "alice",
      email: "alice@example.com",
      roleId: upRole.id,
    });

    const { source, destination } = makeAdapters();
    await migrateUsers({ source, destination });

    const report = await migrateRoles(strapi);

    expect(report.skipped).toBeGreaterThanOrEqual(1);
    expect(report.created).toBe(0);

    // Cleanup
    await strapi
      .documents(API_ROLE_UID)
      .delete({ documentId: existing.documentId });
    await strapi.db
      .query(UP_ROLE_UID)
      .delete({ where: { id: upRole.id } });
  });

  it("dry-run: does not create roles or assign users", async () => {
    const upRole = (await strapi.db.query(UP_ROLE_UID).create({
      data: { name: "DryEditor", description: "Dry run editors", type: "dry-editor" },
    })) as { id: number };

    await createUpUser({
      username: "dryuser",
      email: "dryuser@example.com",
      roleId: upRole.id,
    });

    const { source, destination } = makeAdapters();
    await migrateUsers({ source, destination });

    const report = await migrateRoles(strapi, { dryRun: true });

    // Role should NOT have been created
    const apiRole = await strapi
      .documents(API_ROLE_UID)
      .findFirst({ filters: { name: "DryEditor" } });
    expect(apiRole).toBeNull();

    expect(report.created).toBeGreaterThanOrEqual(1); // counted as would-create
    expect(report.errors).toHaveLength(0);

    // Cleanup
    await strapi.db
      .query(UP_ROLE_UID)
      .delete({ where: { id: upRole.id } });
  });
});
