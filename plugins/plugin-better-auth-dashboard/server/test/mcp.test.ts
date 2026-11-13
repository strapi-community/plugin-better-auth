import { setupStrapi, stopStrapi } from "@strapi-community/dev-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { McpRegistrar } from "../src/mcp/shared";
import { registerBanTools } from "../src/mcp/tools/ban-user";
import { registerGetUser } from "../src/mcp/tools/get-user";
import { registerListUsers } from "../src/mcp/tools/list-users";
import { registerSignupsGraph } from "../src/mcp/tools/signups-graph";
import { registerUpdateUser } from "../src/mcp/tools/update-user";
import { registerUserStats } from "../src/mcp/tools/user-stats";

const USER_UID = "plugin::better-auth.user";

// Collects the tool definitions each register function hands to strapi.ai.mcp, so
// the handlers can be exercised directly against the booted Strapi + Better Auth.
type ToolDef = Parameters<McpRegistrar["registerTool"]>[0];

function collect() {
  const tools = new Map<string, ToolDef>();
  const registrar: McpRegistrar = {
    registerTool: (t) => tools.set(t.name, t),
  };
  registerListUsers(registrar);
  registerGetUser(registrar);
  registerUpdateUser(registrar);
  registerUserStats(registrar);
  registerSignupsGraph(registrar);
  registerBanTools(registrar);
  return tools;
}

// biome-ignore lint/suspicious/noExplicitAny: handler result is intentionally loose in tests
async function run(tool: ToolDef, args?: unknown): Promise<any> {
  const handler = tool.createHandler(strapi, {});
  return handler({ args: args as never });
}

/**
 * Validate a tool's `structuredContent` against the output schema it declares —
 * the same check the MCP runtime performs before returning the result. Running
 * the handler alone does not exercise this (it just builds the payload), so a
 * schema mismatch like a `Date` where `string | number` is declared only
 * surfaces here or over the wire. Returns the parsed value or throws.
 */
function expectValidOutput(
  tool: ToolDef,
  result: { structuredContent: unknown },
) {
  return tool.resolveOutputSchema().parse(result.structuredContent);
}

let tools: Map<string, ToolDef>;
let aliceId: string;

beforeAll(async () => {
  await setupStrapi();

  const users = strapi.documents(USER_UID);
  const alice = await users.create({
    data: {
      name: "Alice MCP",
      email: "alice.mcp@test.dev",
      emailVerified: true,
    },
  });
  aliceId = String(alice.id);
  await users.create({
    data: { name: "Bob MCP", email: "bob.mcp@test.dev", emailVerified: false },
  });
  await users.create({
    data: {
      name: "Carol MCP",
      email: "carol.mcp@test.dev",
      emailVerified: true,
    },
  });

  tools = collect();
}, 120_000);

afterAll(async () => {
  await stopStrapi();
});

describe("tool registration", () => {
  it("registers the user + analytics tools that the dashboard also offers", () => {
    expect([...tools.keys()].sort()).toEqual(
      [
        "better_auth_ban_user",
        "better_auth_get_user",
        "better_auth_list_users",
        "better_auth_signups_graph",
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
  it("lists seeded users via the dash() plugin", async () => {
    const res = await run(tools.get("better_auth_list_users")!, { limit: 100 });
    expect(res.structuredContent.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.structuredContent.users)).toBe(true);
  });

  it("returns dates the output schema accepts (dash() hands back Date objects)", async () => {
    const listUsers = tools.get("better_auth_list_users")!;
    const res = await run(listUsers, { limit: 100 });

    // Regression: without normalizing the dash() Date fields this throws
    // ("createdAt: Invalid input"), exactly as the MCP runtime would reject it.
    expect(() => expectValidOutput(listUsers, res)).not.toThrow();

    const withDate = res.structuredContent.users.find(
      (u: { createdAt: unknown }) => u.createdAt != null,
    );
    expect(
      withDate,
      "expected at least one user with a createdAt",
    ).toBeTruthy();
    expect(typeof withDate.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(withDate.createdAt))).toBe(false);
  });

  it("searches by email", async () => {
    const res = await run(tools.get("better_auth_list_users")!, {
      search: "alice.mcp",
      limit: 100,
    });
    const emails = res.structuredContent.users.map(
      (u: { email: string }) => u.email,
    );
    expect(emails).toContain("alice.mcp@test.dev");
  });
});

describe("better_auth_get_user", () => {
  it("finds a user by id and reports a miss", async () => {
    const hit = await run(tools.get("better_auth_get_user")!, {
      userId: aliceId,
    });
    expect(hit.structuredContent.found).toBe(true);
    expect(hit.structuredContent.user.email).toBe("alice.mcp@test.dev");

    const miss = await run(tools.get("better_auth_get_user")!, {
      userId: "99999999",
    });
    expect(miss.structuredContent.found).toBe(false);
  });

  it("returns a user whose dates pass the output schema", async () => {
    const getUser = tools.get("better_auth_get_user")!;
    const hit = await run(getUser, { userId: aliceId });

    expect(() => expectValidOutput(getUser, hit)).not.toThrow();
    expect(typeof hit.structuredContent.user.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(hit.structuredContent.user.createdAt))).toBe(
      false,
    );
  });
});

describe("better_auth_user_stats", () => {
  it("returns the dashboard stats shape", async () => {
    const res = await run(tools.get("better_auth_user_stats")!);
    const s = res.structuredContent;
    expect(s).toHaveProperty("weekly");
    expect(s).toHaveProperty("monthly");
    expect(s).toHaveProperty("activeUsers");
  });
});

describe("better_auth_signups_graph", () => {
  it("returns a daily time series", async () => {
    const res = await run(tools.get("better_auth_signups_graph")!, {
      period: "daily",
    });
    expect(res.structuredContent.period).toBeTruthy();
    expect(Array.isArray(res.structuredContent.points)).toBe(true);
  });

  it("emits ISO date strings that pass the output schema", async () => {
    const graph = tools.get("better_auth_signups_graph")!;
    const res = await run(graph, { period: "monthly" });

    expect(() => expectValidOutput(graph, res)).not.toThrow();
    expect(res.structuredContent.points.length).toBeGreaterThan(0);
    for (const point of res.structuredContent.points) {
      // Machine-readable ISO (2026-06-16T…), not the locale "Tue Jun 16 2026 …"
      // String(Date) form the dash() Date object produces unnormalized.
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe("better_auth_update_user", () => {
  it("updates a profile field through the dash() plugin", async () => {
    const res = await run(tools.get("better_auth_update_user")!, {
      userId: aliceId,
      name: "Alice Updated",
    });
    expect(res.structuredContent.updated).toBe(true);
    expect(res.structuredContent.user.name).toBe("Alice Updated");
  });
});

describe("better_auth_ban_user / unban", () => {
  it("bans and unbans a user through the dash() plugin", async () => {
    const created = await strapi.documents(USER_UID).create({
      data: {
        name: "Dave MCP",
        email: "dave.mcp@test.dev",
        emailVerified: true,
      },
    });

    const ban = await run(tools.get("better_auth_ban_user")!, {
      userId: String(created.id),
      banReason: "spam",
    });
    expect(ban.structuredContent.banned).toBe(true);

    const check = await run(tools.get("better_auth_get_user")!, {
      userId: String(created.id),
    });
    expect(check.structuredContent.user.banned).toBe(true);

    const unban = await run(tools.get("better_auth_unban_user")!, {
      userId: String(created.id),
    });
    expect(unban.structuredContent.unbanned).toBe(true);
  });
});
