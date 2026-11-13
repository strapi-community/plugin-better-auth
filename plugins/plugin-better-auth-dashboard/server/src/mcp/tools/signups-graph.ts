import { z } from "@strapi/utils";
import { getDashApi } from "../../utils/dash";
import { ACTION } from "../constants";
import {
  dashErrorMessage,
  type McpRegistrar,
  normalizeDashDate,
  toolError,
  toolResult,
} from "../shared";

/**
 * `better_auth_signups_graph` — the dashboard Overview's sign-up time series via
 * the dash() plugin: new / active / total users per point, by day, week or month.
 */
export function registerSignupsGraph(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_signups_graph",
    title: "Better Auth sign-ups over time",
    description:
      "Return a time series of Better Auth user sign-ups (via the dashboard API), bucketed by day, week or month. Each point has newUsers, activeUsers and the running totalUsers.",
    auth: { policies: [{ action: ACTION.OVERVIEW_READ }] },
    resolveInputSchema: () =>
      z.object({
        period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
      }),
    resolveOutputSchema: () =>
      z.object({
        period: z.string(),
        points: z.array(
          z.object({
            date: z.string(),
            label: z.string(),
            totalUsers: z.number(),
            newUsers: z.number(),
            activeUsers: z.number(),
          }),
        ),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        try {
          const { auth, headers } = await getDashApi(strapi);
          const graph = await auth.api.dashGetUserGraphData({
            query: { period: args.period },
            headers,
          });

          return toolResult({
            period: graph.period ?? args.period,
            points: (graph.data ?? []).map((p) => ({
              // dash() returns `date` as a JS Date; emit ISO (machine-readable)
              // rather than the locale `String(Date)` form ("Tue Jun 16 2026 …").
              date: String(normalizeDashDate(p.date) ?? ""),
              label: String(p.label ?? ""),
              totalUsers: Number(p.totalUsers ?? 0),
              newUsers: Number(p.newUsers ?? 0),
              activeUsers: Number(p.activeUsers ?? 0),
            })),
          });
        } catch (e) {
          return toolError(`Failed to load graph: ${dashErrorMessage(e)}`);
        }
      },
  });
}
