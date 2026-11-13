import { z } from "@strapi/utils";
import { callDash } from "../../utils/dash";
import { ACTION } from "../constants";
import {
  dashUserOutput,
  type McpRegistrar,
  mapDashUser,
  toolResult,
} from "../shared";

/**
 * `better_auth_get_user` — fetch a single Better Auth user by id via the dash()
 * plugin (the Better Auth user id, as returned by `better_auth_list_users`).
 */
export function registerGetUser(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_get_user",
    title: "Get a Better Auth user",
    description:
      "Fetch a single Better Auth user by its Better Auth user id (use better_auth_list_users to find the id). Returns the user and its session/account counts.",
    auth: { policies: [{ action: ACTION.USER_READ }] },
    resolveInputSchema: () =>
      z.object({
        userId: z.string().describe("The Better Auth user id"),
      }),
    resolveOutputSchema: () =>
      z.object({
        found: z.boolean(),
        user: dashUserOutput.nullable(),
        sessionsCount: z.number().optional(),
        accountsCount: z.number().optional(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { ok, data } = await callDash(strapi, {
          path: "user",
          method: "GET",
          context: { userId: args.userId },
        });

        if (!ok) {
          return toolResult({ found: false, user: null });
        }

        const body = data as Record<string, unknown> & {
          session?: unknown[];
          account?: unknown[];
        };

        return toolResult({
          found: true,
          user: mapDashUser(body),
          sessionsCount: Array.isArray(body.session)
            ? body.session.length
            : undefined,
          accountsCount: Array.isArray(body.account)
            ? body.account.length
            : undefined,
        });
      },
  });
}
