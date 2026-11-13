import path from "node:path";
import { appsDir, setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateFromUsersPermissions } from "../src/migrations/users-permissions/migrate";
import { isBcryptHash } from "../src/migrations/users-permissions/password";

const migrationAppDir = path.join(appsDir, "playground-up-migration");

const PASSWORD = "password123";

// Minimal shape of the playground's Better Auth API used in this test.
interface MigrationAuth {
  api: {
    signInEmail: (args: {
      body: { email: string; password: string };
    }) => Promise<{ user: { id: string } }>;
  };
}

// biome-ignore lint/suspicious/noExplicitAny: loose Strapi typing for cross-plugin UIDs
type AnyStrapi = any;

let strapi: AnyStrapi;
let bcryptHash: string;

const dbQuery = (uid: string) => strapi.db.query(uid);
const docs = (uid: string) => strapi.documents(uid);

beforeAll(async () => {
  strapi = await setupStrapi({ appDir: migrationAppDir });

  bcryptHash = await bcrypt.hash(PASSWORD, 10);

  // users-permissions seeds the Authenticated/Public roles on boot; add a custom one.
  const authenticated = await dbQuery("plugin::users-permissions.role").findOne(
    {
      where: { type: "authenticated" },
    },
  );
  const editor = await dbQuery("plugin::users-permissions.role").create({
    data: { name: "Editor", description: "Can edit", type: "editor" },
  });

  // A permission on the Editor role whose action exists in API Permissions.
  await dbQuery("plugin::users-permissions.permission").create({
    data: { action: "api::test.test.find", role: editor.id },
  });

  // Seed users directly through the query engine so the bcrypt hash is stored
  // verbatim (no lifecycle re-hashing) and we know the plaintext.
  await dbQuery("plugin::users-permissions.user").create({
    data: {
      username: "alice",
      email: "alice@example.com",
      provider: "local",
      password: bcryptHash,
      confirmed: true,
      blocked: false,
      role: editor.id,
    },
  });
  await dbQuery("plugin::users-permissions.user").create({
    data: {
      username: "bob",
      email: "bob@example.com",
      provider: "google",
      confirmed: true,
      blocked: false,
      role: authenticated.id,
    },
  });
  await dbQuery("plugin::users-permissions.user").create({
    data: {
      username: "carol",
      email: "carol@example.com",
      provider: "local",
      password: bcryptHash,
      confirmed: false,
      blocked: true,
      role: authenticated.id,
    },
  });
}, 120000);

afterAll(async () => {
  await stopStrapi();
});

describe("users-permissions → Better Auth migration", () => {
  it("migrates users, credentials, roles and permissions", async () => {
    const summary = await migrateFromUsersPermissions(strapi);

    expect(summary).not.toBeNull();
    // alice + bob + carol (the migration may also re-touch pre-seeded defaults,
    // but these three are the ones we added).
    expect(summary!.users).toBeGreaterThanOrEqual(3);
    expect(summary!.credentialAccounts).toBeGreaterThanOrEqual(2); // alice, carol
    expect(summary!.oauthDeferred).toBeGreaterThanOrEqual(1); // bob
    expect(summary!.failedUsers).toBe(0);
  });

  it("maps user fields onto the Better Auth user", async () => {
    const alice = await docs("plugin::better-auth.user").findFirst({
      filters: { email: "alice@example.com" },
      populate: ["roles"],
    });
    expect(alice).toBeTruthy();
    expect(alice.name).toBe("alice");
    expect(alice.emailVerified).toBe(true);
    expect(alice.banned).toBe(false);
    expect(
      alice.roles?.some((r: { name: string }) => r.name === "Editor"),
    ).toBe(true);

    const carol = await docs("plugin::better-auth.user").findFirst({
      filters: { email: "carol@example.com" },
    });
    expect(carol.emailVerified).toBe(false);
    expect(carol.banned).toBe(true);
  });

  it("creates a credential account holding the bcrypt hash for local users", async () => {
    const alice = await docs("plugin::better-auth.user").findFirst({
      filters: { email: "alice@example.com" },
    });
    const accounts = await docs("plugin::better-auth.account").findMany({
      filters: { userId: alice.id, providerId: "credential" },
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].password).toBe(bcryptHash);
    expect(isBcryptHash(accounts[0].password)).toBe(true);
  });

  it("does not create a credential account for OAuth users", async () => {
    const bob = await docs("plugin::better-auth.user").findFirst({
      filters: { email: "bob@example.com" },
    });
    const accounts = await docs("plugin::better-auth.account").findMany({
      filters: { userId: bob.id },
    });
    expect(accounts).toHaveLength(0);
  });

  it("translates compatible role permissions into API Permissions", async () => {
    const editor = await docs("plugin::api-permissions.role").findFirst({
      filters: { name: "Editor" },
      populate: ["permissions"],
    });
    expect(editor).toBeTruthy();
    expect(
      editor.permissions?.some(
        (p: { action: string }) => p.action === "api::test.test.find",
      ),
    ).toBe(true);
  });

  it("lets a migrated user sign in with their old bcrypt password, then rehashes to scrypt", async () => {
    const auth = strapi
      .plugin("better-auth")
      .service("auth-service")
      .getAuth() as MigrationAuth;

    const result = await auth.api.signInEmail({
      body: { email: "alice@example.com", password: PASSWORD },
    });
    expect(result?.user?.id).toBeTruthy();

    const alice = await docs("plugin::better-auth.user").findFirst({
      filters: { email: "alice@example.com" },
    });
    const accounts = await docs("plugin::better-auth.account").findMany({
      filters: { userId: alice.id, providerId: "credential" },
    });
    // The after-hook upgraded the stored hash away from bcrypt.
    expect(isBcryptHash(accounts[0].password)).toBe(false);
  });
});
