import type { Core } from "@strapi/types";
import { z } from "@strapi/utils";
import { ACTION, SESSION_UID, USER_UID } from "../constants";
import {
  type McpRegistrar,
  query,
  toolResult,
  userHasAttribute,
} from "../shared";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * `better_auth_user_stats` — high-level counts for a dashboard overview:
 * total users, verified users, banned users, active sessions and recent sign-ups.
 */
export function registerUserStats(strapi: Core.Strapi, mcp: McpRegistrar) {
  const canBan = userHasAttribute(strapi, USER_UID, "banned");

  mcp.registerTool({
    name: "better_auth_user_stats",
    title: "Better Auth user statistics",
    description:
      "Return high-level Better Auth statistics: total users, email-verified users, banned users, currently-active sessions and sign-ups in the last 7 and 30 days.",
    auth: { policies: [{ action: ACTION.OVERVIEW_READ }] },
    resolveOutputSchema: () =>
      z.object({
        totalUsers: z.number(),
        verifiedUsers: z.number(),
        bannedUsers: z.number().nullable(),
        activeSessions: z.number(),
        newUsersLast7Days: z.number(),
        newUsersLast30Days: z.number(),
        generatedAt: z.string(),
      }),
    createHandler: (strapi) => async () => {
      const users = query(strapi, USER_UID);
      const sessions = query(strapi, SESSION_UID);
      const now = new Date();

      const [
        totalUsers,
        verifiedUsers,
        bannedUsers,
        activeSessions,
        newUsersLast7Days,
        newUsersLast30Days,
      ] = await Promise.all([
        users.count(),
        users.count({ where: { emailVerified: true } }),
        canBan
          ? users.count({ where: { banned: true } })
          : Promise.resolve(null),
        sessions.count({ where: { expiresAt: { $gt: now } } }),
        users.count({ where: { createdAt: { $gte: daysAgo(7) } } }),
        users.count({ where: { createdAt: { $gte: daysAgo(30) } } }),
      ]);

      return toolResult({
        totalUsers,
        verifiedUsers,
        bannedUsers,
        activeSessions,
        newUsersLast7Days,
        newUsersLast30Days,
        generatedAt: now.toISOString(),
      });
    },
  });
}
