import { createHash } from "node:crypto";
import type { UID } from "@strapi/strapi";
import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPluginService } from "../src/utils";

// The subset of the playground's auth API (organization, jwt and dash plugins) used here.
interface PlaygroundAuth {
  handler: (request: Request) => Promise<Response>;
  api: {
    signUpEmail: (args: {
      body: { email: string; password: string; name: string };
    }) => Promise<{ user: { id: string } }>;
    createOrganization: (args: {
      body: { name: string; slug: string; userId: string };
    }) => Promise<{ id: string }>;
    addMember: (args: {
      body: { userId: string; organizationId: string; role: string };
    }) => Promise<unknown>;
    signJWT: (args: {
      body: { payload: Record<string, unknown> };
    }) => Promise<{ token: string }>;
  };
}

interface ForeignKeyInfo {
  columns: string[];
  referencedTable: string;
  onDelete?: string | null;
}

const UIDS = {
  user: "plugin::better-auth.user",
  organization: "plugin::better-auth.organization",
  member: "plugin::better-auth.member",
  invitation: "plugin::better-auth.invitation",
  team: "plugin::better-auth.team",
  teamMember: "plugin::better-auth.team-member",
} as const satisfies Record<string, UID.ContentType>;

const DASHBOARD_API_KEY =
  process.env.BETTER_AUTH_DASHBOARD_SECRET || "strapi-internal-dashboard-key";

const getAuth = () =>
  getPluginService("auth-service").getAuth() as unknown as PlaygroundAuth;

const getForeignKeys = (table: string): Promise<ForeignKeyInfo[]> =>
  strapi.db.dialect.schemaInspector.getForeignKeys(table);

const count = (uid: UID.ContentType, where: Record<string, unknown>) =>
  strapi.db.query(uid).count({ where });

let fixtureCounter = 0;

/**
 * Creates an organization with an owner, a second member, an invitation, and a
 * team with a team member, so cascades can be checked across every level.
 */
async function createOrganizationFixture() {
  const auth = getAuth();
  const suffix = `${Date.now()}-${fixtureCounter++}`;

  const { user: owner } = await auth.api.signUpEmail({
    body: {
      email: `owner-${suffix}@example.com`,
      password: "password1234",
      name: "Owner",
    },
  });
  const { user: member } = await auth.api.signUpEmail({
    body: {
      email: `member-${suffix}@example.com`,
      password: "password1234",
      name: "Member",
    },
  });

  const organization = await auth.api.createOrganization({
    body: { name: `Org ${suffix}`, slug: `org-${suffix}`, userId: owner.id },
  });
  await auth.api.addMember({
    body: {
      userId: member.id,
      organizationId: organization.id,
      role: "member",
    },
  });

  const organizationId = Number(organization.id);

  await strapi.documents(UIDS.invitation).create({
    data: {
      organizationId,
      email: `invitee-${suffix}@example.com`,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      inviterId: Number(owner.id),
    },
  });

  const team = await strapi.documents(UIDS.team).create({
    data: { name: `Team ${suffix}`, organizationId },
  });
  await strapi.documents(UIDS.teamMember).create({
    data: { teamId: team.id, userId: Number(member.id) },
  });

  return {
    organizationId,
    teamId: team.id as number,
    userIds: [Number(owner.id), Number(member.id)],
  };
}

type Fixture = Awaited<ReturnType<typeof createOrganizationFixture>>;

async function expectOrganizationFixture(fixture: Fixture, exists: boolean) {
  const { organizationId, teamId } = fixture;
  const expected = (n: number) => (exists ? n : 0);

  expect(await count(UIDS.organization, { id: organizationId })).toBe(
    expected(1),
  );
  expect(await count(UIDS.member, { organizationId })).toBe(expected(2));
  expect(await count(UIDS.invitation, { organizationId })).toBe(expected(1));
  expect(await count(UIDS.team, { id: teamId })).toBe(expected(1));
  expect(await count(UIDS.teamMember, { teamId })).toBe(expected(1));

  // Users are referenced by members, never the other way around.
  expect(await count(UIDS.user, { id: { $in: fixture.userIds } })).toBe(2);
}

/**
 * Calls a dash() endpoint the same way the dashboard plugin's proxy controller does.
 */
async function callDashEndpoint(
  path: string,
  context: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const auth = getAuth();
  const apiKeyHash = createHash("sha256")
    .update(DASHBOARD_API_KEY)
    .digest("hex");
  const { token } = await auth.api.signJWT({
    body: {
      payload: { iat: Math.floor(Date.now() / 1000), apiKeyHash, ...context },
    },
  });

  return auth.handler(
    new Request(`${process.env.BETTER_AUTH_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  await setupStrapi();
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

describe("foreign keys — schema", () => {
  it.each([
    ["ba_member", "organization_id", "ba_organization"],
    ["ba_member", "user_id", "ba_user"],
    ["ba_invitation", "organization_id", "ba_organization"],
    ["ba_invitation", "inviter_id", "ba_user"],
    ["ba_team", "organization_id", "ba_organization"],
    ["ba_team_member", "team_id", "ba_team"],
    ["ba_session", "user_id", "ba_user"],
    ["ba_account", "user_id", "ba_user"],
  ])("%s.%s references %s with ON DELETE CASCADE", async (table, column, referencedTable) => {
    const foreignKeys = await getForeignKeys(table);

    expect(foreignKeys).toContainEqual(
      expect.objectContaining({
        columns: [column],
        referencedTable,
        onDelete: "CASCADE",
      }),
    );
  });

  it("does not declare foreign keys for fields without a reference", async () => {
    const foreignKeys = await getForeignKeys("ba_session");

    expect(foreignKeys.flatMap((fk) => fk.columns)).not.toContain(
      "active_organization_id",
    );
  });
});

describe("foreign keys — cascading deletes", () => {
  it("cascades when an organization is deleted through the Document Service", async () => {
    const fixture = await createOrganizationFixture();
    await expectOrganizationFixture(fixture, true);

    const organization = await strapi
      .documents(UIDS.organization)
      .findFirst({ filters: { id: fixture.organizationId } });
    await strapi
      .documents(UIDS.organization)
      .delete({ documentId: organization!.documentId });

    await expectOrganizationFixture(fixture, false);
  });

  it("cascades when an organization is deleted through dash /organization/delete", async () => {
    const fixture = await createOrganizationFixture();
    const organizationId = String(fixture.organizationId);

    const response = await callDashEndpoint(
      "/dash/organization/delete",
      { organizationId },
      { organizationId },
    );

    expect(response.status).toBe(200);
    await expectOrganizationFixture(fixture, false);
  });

  it("cascades when organizations are deleted through dash /organization/delete-many", async () => {
    const fixtures = [
      await createOrganizationFixture(),
      await createOrganizationFixture(),
    ];
    const organizationIds = fixtures.map((f) => String(f.organizationId));

    const response = await callDashEndpoint(
      "/dash/organization/delete-many",
      { organizationIds },
      {},
    );

    expect(response.status).toBe(200);
    for (const fixture of fixtures) {
      await expectOrganizationFixture(fixture, false);
    }
  });
});
