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
      expect(res.status).toBe(403);
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
    expect(res.status).toBe(403);
  });

  it("refuses passkeys when the passkey plugin isn't installed", async () => {
    const res = await request(strapi.server.httpServer)
      .delete(`${BASE}/anything`)
      .query({ uid: PASSKEY_UID, userId })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

describe("db route — update timestamps", () => {
  async function createUser() {
    return strapi.documents(USER_UID).create({
      data: {
        name: "Timestamp User",
        email: `ts-${Math.random().toString(36).slice(2)}@test.dev`,
        emailVerified: true,
      },
    });
  }

  it("writes createdAt and updatedAt as submitted", async () => {
    const user = await createUser();
    const createdAt = "2020-01-02T03:04:05.000Z";
    const updatedAt = "2021-06-07T08:09:10.000Z";

    const res = await request(strapi.server.httpServer)
      .put(`${BASE}/${user.documentId}`)
      .query({ uid: USER_UID })
      .send({ name: "Renamed", createdAt, updatedAt })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const stored = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(stored?.name).toBe("Renamed");
    expect(new Date(stored?.createdAt as string).toISOString()).toBe(createdAt);
    expect(new Date(stored?.updatedAt as string).toISOString()).toBe(updatedAt);
    expect(new Date(res.body.updatedAt).toISOString()).toBe(updatedAt);
  });

  it("updates timestamps without other fields", async () => {
    const user = await createUser();
    const createdAt = "2019-12-31T23:59:59.000Z";

    const res = await request(strapi.server.httpServer)
      .put(`${BASE}/${user.documentId}`)
      .query({ uid: USER_UID })
      .send({ createdAt })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const stored = await strapi
      .documents(USER_UID)
      .findOne({ documentId: user.documentId });
    expect(new Date(stored?.createdAt as string).toISOString()).toBe(createdAt);
  });

  it("rejects invalid dates", async () => {
    const user = await createUser();
    const res = await request(strapi.server.httpServer)
      .put(`${BASE}/${user.documentId}`)
      .query({ uid: USER_UID })
      .send({ createdAt: "not-a-date" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown documents", async () => {
    const res = await request(strapi.server.httpServer)
      .put(`${BASE}/does-not-exist`)
      .query({ uid: USER_UID })
      .send({ createdAt: "2020-01-01T00:00:00.000Z" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
