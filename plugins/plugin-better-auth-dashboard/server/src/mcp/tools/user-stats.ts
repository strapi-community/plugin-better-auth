import { z } from "@strapi/utils";
import { callDash } from "../../utils/dash";
import { ACTION } from "../constants";
import { type McpRegistrar, toolError, toolResult } from "../shared";

const signupPeriod = z.object({
  signUps: z.number().nullable(),
  percentage: z.number().nullable(),
});
const activePeriod = z.object({
  active: z.number().nullable(),
  percentage: z.number().nullable(),
});

/**
 * `better_auth_user_stats` — the dashboard Overview's headline stats via the
 * dash() plugin: total users, sign-ups per period (with % deltas) and active
 * users. `weekly.signUps` answers "how many signed up last week".
 */
export function registerUserStats(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_user_stats",
    title: "Better Auth user statistics",
    description:
      "Return Better Auth user statistics (via the dashboard API): total users, sign-ups in the last day/week/month with percentage change vs the previous period, and active users per period.",
    auth: { policies: [{ action: ACTION.OVERVIEW_READ }] },
    resolveOutputSchema: () =>
      z.object({
        total: z.number().nullable(),
        daily: signupPeriod,
        weekly: signupPeriod,
        monthly: signupPeriod,
        activeUsers: z.object({
          daily: activePeriod,
          weekly: activePeriod,
          monthly: activePeriod,
        }),
        degraded: z.boolean().optional(),
      }),
    createHandler: (strapi) => async () => {
      const { ok, data } = await callDash(strapi, {
        path: "user-stats",
        method: "GET",
      });

      if (!ok)
        return toolError(`Failed to load stats: ${JSON.stringify(data)}`);
      return toolResult(data);
    },
  });
}
