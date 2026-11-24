import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const USER_UID = "plugin::better-auth.user";
const SESSION_UID = "plugin::better-auth.session";
// Not installed in the playground; the allowlist check runs before any lookup.
const PASSKEY_UID = "plugin::better-auth.passkey";
const BASE = "/better-auth-dashboard/db";

let adminToken: string;
let userId: number;

beforeAll(async () => {
  await setupStrapi();

  // Fresh database: register the first super admin to get an admin JWT.
  const res = await request(strapi.server.httpServer)
    .post("/admin/register-admin")
    .send({
      firstname: "Db",
      lastname: "Admin",
      email: `db-admin-${Date.now()}@test.dev`,
      password: "Password123!",
    });
  adminToken = res.body?.data?.token ?? res.body?.data?.accessToken;
  expect(adminToken, JSON.stringify(res.body)).toBeTruthy();

  const user = await strapi.documents(USER_UID).create({
    data: { name: "Db User", email: "db.user@test.dev", emailVerified: true },
  });
  userId = user.id;
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

async function createSession() {
  return strapi.documents(SESSION_UID).create({
    data: {
      userId,
      token: `tok-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
  });
}

describe("db route — delete", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(strapi.server.httpServer)
      .delete(`${BASE}/anything`)
      .query({ uid: PASSKEY_UID, userId });
    expect([401, 403]).toContain(res.status);
  });

  it("refuses Better Auth content types other than passkeys", async () => {
    const session = await createSession();
    for (const uid of [SESSION_UID, "plugin::better-auth.jwks"]) {
      const res = await request(strapi.server.httpServer)
        .delete(`${BASE}/${session.documentId}`)
        .query({ uid, userId })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    }
    expect(
      await strapi
        .documents(SESSION_UID)
        .findOne({ documentId: session.documentId }),
    ).not.toBeNull();
  });

  it("refuses content types outside plugin::better-auth", async () => {
    const res = await request(strapi.server.httpServer)
      .delete(`${BASE}/anything`)
      .query({ uid: "admin::user", userId })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("requires the owning userId", async () => {
    const res = await request(strapi.server.httpServer)
      .delete(`${BASE}/anything`)
      .query({ uid: PASSKEY_UID })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
