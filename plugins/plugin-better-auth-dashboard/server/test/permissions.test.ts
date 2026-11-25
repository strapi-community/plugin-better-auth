import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The admin routes must only allow what the admin panel allows for the same
 * dashboard permissions (see server/src/permissions.ts).
 */

const USER_UID = "plugin::better-auth.user";
const SESSION_UID = "plugin::better-auth.session";
const ROLE_UID = "plugin::api-permissions.role";
const PASSWORD = "Password123!";

const superEmail = `perm-super-${Date.now()}@test.dev`;
let superToken: string;
let noPermsToken: string;
let overviewToken: string;
let userUpdateToken: string;
let userDocumentId: string;

const http = () => request(strapi.server.httpServer);

async function createAdminWithActions(name: string, actions: string[]) {
  const roleService = strapi.service("admin::role");
  const role = await roleService.create({ name, description: name });
  await roleService.assignPermissions(
    role.id,
    actions.map((action) => ({
      action,
      subject: null,
      properties: {},
      conditions: [],
    })),
  );

  const email = `${name.toLowerCase()}-${Date.now()}@test.dev`;
  await strapi.service("admin::user").create({
    firstname: name,
    lastname: "Admin",
    email,
    password: PASSWORD,
    isActive: true,
    roles: [role.id],
  });

  const res = await http()
    .post("/admin/login")
    .send({ email, password: PASSWORD });
  const token = res.body?.data?.token ?? res.body?.data?.accessToken;
  expect(token, JSON.stringify(res.body)).toBeTruthy();
  return token as string;
}

beforeAll(async () => {
  await setupStrapi();

  const res = await http().post("/admin/register-admin").send({
    firstname: "Super",
    lastname: "Admin",
    email: superEmail,
    password: PASSWORD,
  });
  superToken = res.body?.data?.token ?? res.body?.data?.accessToken;
  expect(superToken, JSON.stringify(res.body)).toBeTruthy();

  noPermsToken = await createAdminWithActions("NoPerms", []);
  overviewToken = await createAdminWithActions("Overview", [
    "plugin::better-auth-dashboard.overview.read",
  ]);
  userUpdateToken = await createAdminWithActions("UserUpdate", [
    "plugin::better-auth-dashboard.user.read",
    "plugin::better-auth-dashboard.user.update",
  ]);

  const user = await strapi.documents(USER_UID).create({
    data: {
      name: "Perm User",
      email: "perm.user@test.dev",
      emailVerified: true,
    },
  });
  userDocumentId = user.documentId;
  await strapi.documents(SESSION_UID).create({
    data: {
      userId: user.id,
      token: "secret-session-token",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
  });
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

describe("admin without any dashboard permission", () => {
  const cases: [string, string, Record<string, string>?][] = [
    ["get", "/better-auth-dashboard/db", { uid: "admin::user" }],
    [
      "get",
      "/better-auth-dashboard/db",
      { uid: "plugin::better-auth.account" },
    ],
    ["get", "/better-auth-dashboard/db", { uid: USER_UID }],
    ["get", "/better-auth-dashboard/db", { uid: SESSION_UID }],
    ["put", "/better-auth-dashboard/db/x", { uid: "admin::user" }],
    ["get", "/better-auth-dashboard/settings"],
    ["get", "/auth/dash/config"],
    ["get", "/auth/dash/list-users"],
    ["post", "/auth/dash/create-user"],
    ["post", "/auth/dash/update-user"],
    ["post", "/auth/dash/delete-user"],
    ["post", "/auth/dash/ban-user"],
    ["post", "/auth/dash/execute-adapter"],
  ];

  it.each(cases)("%s %s %j is forbidden", async (method, path, query) => {
    const res = await (
      http() as unknown as Record<string, (p: string) => request.Test>
    )
      [method](path)
      .query(query ?? {})
      .set("Authorization", `Bearer ${noPermsToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe("admin with only overview.read", () => {
  const auth = () => `Bearer ${overviewToken}`;

  it("can call the Overview endpoints", async () => {
    for (const path of ["user-stats", "list-users", "config"]) {
      const res = await http()
        .get(`/auth/dash/${path}`)
        .set("Authorization", auth());
      expect(res.status, path).not.toBe(403);
    }
  });

  it("cannot call user management endpoints", async () => {
    for (const path of [
      "create-user",
      "delete-user",
      "update-user",
      "ban-user",
    ]) {
      const res = await http()
        .post(`/auth/dash/${path}`)
        .set("Authorization", auth())
        .send({});
      expect(res.status, path).toBe(403);
    }
  });

  it("cannot unlock an endpoint via the query string", async () => {
    const res = await http()
      .post("/auth/dash/delete-user")
      .query({ x: "/auth/dash/user-stats" })
      .set("Authorization", auth())
      .send({});
    expect(res.status).toBe(403);
  });

  it("cannot call dash() endpoints the dashboard never uses", async () => {
    for (const path of [
      "execute-adapter",
      "export-users",
      "impersonate-user",
    ]) {
      const res = await http()
        .get(`/auth/dash/${path}`)
        .set("Authorization", auth());
      expect(res.status, path).toBe(403);
    }
  });

  it("can read the Overview feeds from the db route", async () => {
    for (const uid of [USER_UID, SESSION_UID]) {
      const res = await http()
        .get("/better-auth-dashboard/db")
        .query({ uid })
        .set("Authorization", auth());
      expect(res.status, uid).toBe(200);
    }
  });

  it("cannot update users or read organizations", async () => {
    const put = await http()
      .put(`/better-auth-dashboard/db/${userDocumentId}`)
      .query({ uid: USER_UID })
      .set("Authorization", auth())
      .send({});
    expect(put.status).toBe(403);

    const org = await http()
      .get("/better-auth-dashboard/db")
      .query({ uid: "plugin::better-auth.organization" })
      .set("Authorization", auth());
    expect(org.status).toBe(403);
  });

  describe("admin relations", () => {
    let creatorDocumentId: string;

    beforeAll(async () => {
      const admin = await strapi.db
        .query("admin::user")
        .findOne({ where: { email: superEmail } });
      const user = await strapi.documents(USER_UID).create({
        data: {
          name: "Created By Admin",
          email: "created.by.admin@test.dev",
          emailVerified: true,
          createdBy: admin.id,
          updatedBy: admin.id,
        } as never,
      });
      creatorDocumentId = user.documentId;

      // Sanity check: the record really has an admin creator to leak.
      const raw = await strapi.documents(USER_UID).findOne({
        documentId: creatorDocumentId,
        populate: ["createdBy"] as never,
      });
      expect((raw as { createdBy?: unknown })?.createdBy).toBeTruthy();
    });

    it.each([
      "createdBy",
      "updatedBy",
      "*",
      "createdBy.roles",
    ])("does not populate %s", async (populate) => {
      const res = await http()
        .get("/better-auth-dashboard/db")
        .query({
          uid: USER_UID,
          populate,
          filters: { documentId: { $eq: creatorDocumentId } },
        })
        .set("Authorization", auth());
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(JSON.stringify(res.body)).not.toContain("password");
      expect(res.body.results[0].createdBy).toBeUndefined();
      expect(res.body.results[0].updatedBy).toBeUndefined();
    });

    it.each([
      { createdBy: { password: { $startsWith: "$2" } } },
      { $or: [{ updatedBy: { email: { $eq: "x" } } }] },
      { $not: { createdBy: { id: { $notNull: true } } } },
    ])("rejects filters on admin relations: %j", async (filters) => {
      const res = await http()
        .get("/better-auth-dashboard/db")
        .query({ uid: USER_UID, filters })
        .set("Authorization", auth());
      expect(res.status).toBe(400);
    });
  });

  it("cannot search other content types", async () => {
    const res = await http()
      .get("/better-auth-dashboard/db")
      .query({ uid: ROLE_UID })
      .set("Authorization", auth());
    expect(res.status).toBe(403);
  });
});

describe("admin with user.update", () => {
  const auth = () => `Bearer ${userUpdateToken}`;

  it("can update a user through the db route", async () => {
    const res = await http()
      .put(`/better-auth-dashboard/db/${userDocumentId}`)
      .query({ uid: USER_UID })
      .set("Authorization", auth())
      .send({});
    expect(res.status).toBe(200);
  });

  it("can still populate non-admin relations", async () => {
    const res = await http()
      .get("/better-auth-dashboard/db")
      .query({
        uid: USER_UID,
        populate: "roles,createdBy",
        filters: { documentId: { $eq: userDocumentId } },
      })
      .set("Authorization", auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results[0].roles)).toBe(true);
    expect(res.body.results[0].createdBy).toBeUndefined();
  });

  it("cannot search content types it can't read in the Content Manager", async () => {
    const res = await http()
      .get("/better-auth-dashboard/db")
      .query({ uid: ROLE_UID })
      .set("Authorization", auth());
    expect(res.status).toBe(403);
  });

  it("cannot reach Better Auth tables the dashboard doesn't use", async () => {
    for (const uid of [
      "plugin::better-auth.account",
      "plugin::better-auth.verification",
    ]) {
      const res = await http()
        .get("/better-auth-dashboard/db")
        .query({ uid })
        .set("Authorization", auth());
      expect(res.status, uid).toBe(403);
    }
  });
});

describe("super admin", () => {
  const auth = () => `Bearer ${superToken}`;

  it("still cannot read admin content types or Better Auth secrets", async () => {
    for (const uid of [
      "admin::user",
      "admin::api-token",
      "plugin::better-auth.account",
    ]) {
      const res = await http()
        .get("/better-auth-dashboard/db")
        .query({ uid })
        .set("Authorization", auth());
      expect(res.status, uid).toBe(403);
    }
  });

  it("can search custom relation targets it can read in the Content Manager", async () => {
    const res = await http()
      .get("/better-auth-dashboard/db")
      .query({ uid: ROLE_UID })
      .set("Authorization", auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("can update custom fields on a user", async () => {
    const res = await http()
      .put(`/better-auth-dashboard/db/${userDocumentId}`)
      .query({ uid: USER_UID })
      .set("Authorization", auth())
      .send({ roles: [] });
    expect(res.status).toBe(200);
  });
});
