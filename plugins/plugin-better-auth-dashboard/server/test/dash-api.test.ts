import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt the gateway in before Strapi boots — the route is only registered when
// dashApi.enabled is set (the playground reads this env in config/plugins.ts).
process.env.STRAPI_DASH_API = "true";

const USER_UID = "plugin::better-auth.user";
const BASE = "/api/better-auth-dashboard/dash";

function ctxHeader(ctx: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(ctx)).toString("base64");
}

let accessKey: string;
let daveId: string;

beforeAll(async () => {
  await setupStrapi();

  const dave = await strapi.documents(USER_UID).create({
    data: { name: "Dave GW", email: "dave.gw@test.dev", emailVerified: true },
  });
  daveId = String(dave.id);

  // A content-api API token is how a third party authenticates to the gateway.
  const token = await (
    strapi.service("admin::api-token-content-api") as unknown as {
      create: (a: unknown) => Promise<{ accessKey: string }>;
    }
  ).create({
    name: `dash-gw-${Date.now()}`,
    description: "dash gateway test",
    type: "full-access",
    lifespan: null,
  });
  accessKey = token.accessKey;
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

describe("dash gateway — auth", () => {
  it("rejects requests without an API token", async () => {
    const res = await request(strapi.server.httpServer).get(
      `${BASE}/list-users`,
    );
    expect([401, 403]).toContain(res.status);
  });

  it("rejects an invalid API token", async () => {
    const res = await request(strapi.server.httpServer)
      .get(`${BASE}/list-users`)
      .set("Authorization", "Bearer not-a-real-token");
    expect([401, 403]).toContain(res.status);
  });
});

describe("dash gateway — passthrough", () => {
  it("lists users through the dash() plugin", async () => {
    const res = await request(strapi.server.httpServer)
      .get(`${BASE}/list-users`)
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${accessKey}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("reads overview stats", async () => {
    const res = await request(strapi.server.httpServer)
      .get(`${BASE}/user-stats`)
      .set("Authorization", `Bearer ${accessKey}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("weekly");
  });

  it("bans a user via POST with X-Dash-Context", async () => {
    const res = await request(strapi.server.httpServer)
      .post(`${BASE}/ban-user`)
      .set("Authorization", `Bearer ${accessKey}`)
      .set("X-Dash-Context", ctxHeader({ userId: daveId }))
      .send({ banReason: "gateway test" });

    expect(res.status).toBe(200);

    const check = await request(strapi.server.httpServer)
      .get(`${BASE}/user`)
      .set("Authorization", `Bearer ${accessKey}`)
      .set("X-Dash-Context", ctxHeader({ userId: daveId }));
    expect(check.status).toBe(200);
    expect(check.body.banned).toBe(true);
  });
});
