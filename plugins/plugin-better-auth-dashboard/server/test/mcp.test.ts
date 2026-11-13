import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { McpRegistrar } from "../src/mcp/shared";
import { registerBanTools } from "../src/mcp/tools/ban-user";
import { registerGetUser } from "../src/mcp/tools/get-user";
import { registerListUsers } from "../src/mcp/tools/list-users";
import { registerSetUserRole } from "../src/mcp/tools/set-user-role";
import {
  buildBuckets,
  registerSignupsOverTime,
} from "../src/mcp/tools/signups-over-time";
import { registerUpdateUser } from "../src/mcp/tools/update-user";
import { registerUserStats } from "../src/mcp/tools/user-stats";

const USER_UID = "plugin::better-auth.user";

// Collects the tool definitions a register function would hand to strapi.ai.mcp,
// so each tool's handler can be exercised directly against the booted Strapi.
type ToolDef = Parameters<McpRegistrar["registerTool"]>[0];

function collect() {
  const tools = new Map<string, ToolDef>();
  const registrar: McpRegistrar = {
    registerTool: (t) => tools.set(t.name, t),
  };
  registerListUsers(registrar);
  registerGetUser(registrar);
  registerUpdateUser(registrar);
  registerUserStats(strapi, registrar);
  registerSignupsOverTime(registrar);
  registerBanTools(registrar);
  registerSetUserRole(registrar);
  return tools;
}

async function run(tool: ToolDef, args: unknown) {
  const handler = tool.createHandler(strapi, {});
  return handler({ args: args as never });
}

let tools: Map<string, ToolDef>;

beforeAll(async () => {
  await setupStrapi();

  const users = strapi.documents(USER_UID);
  await users.create({
    data: {
      name: "Alice MCP",
      email: "alice.mcp@test.dev",
      emailVerified: true,
    },
  });
  await users.create({
    data: { name: "Bob MCP", email: "bob.mcp@test.dev", emailVerified: false },
  });
  await users.create({
    data: {
      name: "Carol MCP",
      email: "carol.mcp@test.dev",
      emailVerified: true,
      banned: true,
    },
  });

  tools = collect();
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

describe("buildBuckets", () => {
  it("produces one bucket per day across an inclusive range", () => {
    const from = new Date("2026-01-01T12:00:00Z");
    const to = new Date("2026-01-07T06:00:00Z");
    const buckets = buildBuckets(from, to, "day");
    expect(buckets).toHaveLength(7);
    expect(buckets[0].toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("buckets by calendar month", () => {
    const from = new Date("2026-01-15T00:00:00Z");
    const to = new Date("2026-03-02T00:00:00Z");
    const buckets = buildBuckets(from, to, "month");
    expect(buckets.map((d) => d.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
    ]);
  });
});

describe("tool registration", () => {
  it("registers the full user + analytics tool set", () => {
    expect([...tools.keys()].sort()).toEqual(
      [
        "better_auth_ban_user",
        "better_auth_get_user",
        "better_auth_list_users",
        "better_auth_set_user_role",
        "better_auth_signups_over_time",
        "better_auth_unban_user",
        "better_auth_update_user",
        "better_auth_user_stats",
      ].sort(),
    );
  });

  it("gates every tool behind a dashboard permission", () => {
    for (const tool of tools.values()) {
      expect(tool.auth.policies.length).toBeGreaterThan(0);
      for (const p of tool.auth.policies) {
        expect(p.action).toMatch(/^plugin::better-auth-dashboard\./);
      }
    }
  });
});

describe("better_auth_list_users", () => {
  it("lists seeded users and filters by banned status", async () => {
    const all = await run(tools.get("better_auth_list_users")!, { limit: 100 });
    expect(all.structuredContent.total).toBeGreaterThanOrEqual(3);

    const banned = await run(tools.get("better_auth_list_users")!, {
      limit: 100,
      banned: true,
    });
    const emails = banned.structuredContent.users.map(
      (u: { email: string }) => u.email,
    );
    expect(emails).toContain("carol.mcp@test.dev");
    expect(emails).not.toContain("alice.mcp@test.dev");
  });
});

describe("better_auth_get_user", () => {
  it("finds a user by email and reports a miss", async () => {
    const hit = await run(tools.get("better_auth_get_user")!, {
      email: "alice.mcp@test.dev",
    });
    expect(hit.structuredContent.found).toBe(true);
    expect(hit.structuredContent.user.email).toBe("alice.mcp@test.dev");

    const miss = await run(tools.get("better_auth_get_user")!, {
      email: "nobody@test.dev",
    });
    expect(miss.structuredContent.found).toBe(false);
    expect(miss.structuredContent.user).toBeNull();
  });
});

describe("better_auth_user_stats", () => {
  it("returns coherent totals", async () => {
    const res = await run(tools.get("better_auth_user_stats")!, {});
    const s = res.structuredContent;
    expect(s.totalUsers).toBeGreaterThanOrEqual(3);
    expect(s.verifiedUsers).toBeGreaterThanOrEqual(2);
    expect(s.bannedUsers).toBeGreaterThanOrEqual(1);
    expect(typeof s.activeSessions).toBe("number");
    expect(s.newUsersLast7Days).toBeGreaterThanOrEqual(3);
  });
});

describe("better_auth_signups_over_time", () => {
  it("buckets recent sign-ups by day", async () => {
    const res = await run(tools.get("better_auth_signups_over_time")!, {
      lastDays: 7,
      granularity: "day",
    });
    const s = res.structuredContent;
    expect(s.total).toBeGreaterThanOrEqual(3);
    expect(s.granularity).toBe("day");
    expect(s.buckets.length).toBeGreaterThanOrEqual(7);
    const summed = s.buckets.reduce(
      (acc: number, b: { count: number }) => acc + b.count,
      0,
    );
    expect(summed).toBe(s.total);
  });

  it("rejects an inverted range", async () => {
    const res = await run(tools.get("better_auth_signups_over_time")!, {
      from: "2026-02-01T00:00:00Z",
      to: "2026-01-01T00:00:00Z",
      granularity: "day",
    });
    expect(res.isError).toBe(true);
  });
});

describe("better_auth_ban_user", () => {
  it("bans a user and surfaces the state", async () => {
    const created = await strapi.documents(USER_UID).create({
      data: {
        name: "Dave MCP",
        email: "dave.mcp@test.dev",
        emailVerified: true,
      },
    });

    const res = await run(tools.get("better_auth_ban_user")!, {
      documentId: created.documentId,
      banReason: "spam",
    });
    expect(res.structuredContent.banned).toBe(true);
    expect(typeof res.structuredContent.revokedSessions).toBe("number");

    const check = await run(tools.get("better_auth_get_user")!, {
      documentId: created.documentId,
    });
    expect(check.structuredContent.user.banned).toBe(true);
  });
});
