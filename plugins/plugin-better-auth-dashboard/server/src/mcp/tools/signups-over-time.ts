import { z } from "@strapi/utils";
import { ACTION, USER_UID } from "../constants";
import { type McpRegistrar, query, toolResult } from "../shared";

const MAX_BUCKETS = 400;

export type Granularity = "day" | "week" | "month";

function startOfUTCDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function startOfUTCMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Compute the bucket start boundaries covering [from, to] for the granularity. */
export function buildBuckets(
  from: Date,
  to: Date,
  granularity: Granularity,
): Date[] {
  const starts: Date[] = [];
  let cursor =
    granularity === "month" ? startOfUTCMonth(from) : startOfUTCDay(from);
  const step =
    granularity === "month"
      ? (d: Date) => addMonths(d, 1)
      : granularity === "week"
        ? (d: Date) => addDays(d, 7)
        : (d: Date) => addDays(d, 1);

  while (cursor <= to && starts.length < MAX_BUCKETS) {
    starts.push(cursor);
    cursor = step(cursor);
  }
  return starts;
}

/**
 * `better_auth_signups_over_time` — sign-up counts bucketed by day/week/month.
 *
 * Answers questions like "how many users signed up in the last week". Provide
 * either `lastDays` or an explicit `from`/`to` range.
 */
export function registerSignupsOverTime(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_signups_over_time",
    title: "Better Auth sign-ups over time",
    description:
      "Count Better Auth user sign-ups over a time range, bucketed by day, week or month. Provide `lastDays` (e.g. 7 for the last week) or an explicit `from`/`to` ISO date range; defaults to the last 30 days.",
    auth: { policies: [{ action: ACTION.OVERVIEW_READ }] },
    resolveInputSchema: () =>
      z.object({
        lastDays: z
          .number()
          .int()
          .min(1)
          .max(3650)
          .optional()
          .describe("Count sign-ups over the last N days, ending now"),
        from: z
          .string()
          .optional()
          .describe(
            "Range start as an ISO date/datetime (ignored if lastDays is set)",
          ),
        to: z
          .string()
          .optional()
          .describe("Range end as an ISO date/datetime (defaults to now)"),
        granularity: z.enum(["day", "week", "month"]).default("day"),
      }),
    resolveOutputSchema: () =>
      z.object({
        from: z.string(),
        to: z.string(),
        granularity: z.enum(["day", "week", "month"]),
        total: z.number(),
        truncated: z.boolean(),
        buckets: z.array(z.object({ period: z.string(), count: z.number() })),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { lastDays, granularity } = args;

        const to = args.to ? new Date(args.to) : new Date();
        let from: Date;
        if (lastDays) {
          from = addDays(to, -lastDays);
        } else if (args.from) {
          from = new Date(args.from);
        } else {
          from = addDays(to, -30);
        }

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          return {
            content: [{ type: "text", text: "Invalid `from` or `to` date." }],
            isError: true,
          };
        }
        if (from > to) {
          return {
            content: [{ type: "text", text: "`from` must be before `to`." }],
            isError: true,
          };
        }

        const users = query(strapi, USER_UID);
        const starts = buildBuckets(from, to, granularity as Granularity);

        const [total, counts] = await Promise.all([
          users.count({ where: { createdAt: { $gte: from, $lte: to } } }),
          Promise.all(
            starts.map((start: Date, i: number) => {
              const next = starts[i + 1] ?? addDays(to, 1);
              return users.count({
                where: { createdAt: { $gte: start, $lt: next } },
              });
            }),
          ),
        ]);

        return toolResult({
          from: from.toISOString(),
          to: to.toISOString(),
          granularity,
          total,
          truncated: starts.length >= MAX_BUCKETS,
          buckets: starts.map((start: Date, i: number) => ({
            period: start.toISOString(),
            count: counts[i],
          })),
        });
      },
  });
}
