import { z } from "@strapi/utils";
import { getDashApi } from "../../utils/dash";
import { ACTION } from "../constants";
import {
  dashErrorMessage,
  dashUserOutput,
  isNotFoundError,
  type McpRegistrar,
  mapDashUser,
  toolError,
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
        try {
          const { auth, headers } = await getDashApi(strapi, {
            userId: args.userId,
          });
          const user = await auth.api.getDashUser({ query: {}, headers });

          const raw = user as unknown as {
            session?: unknown[];
            account?: unknown[];
          };

          return toolResult({
            found: true,
            user: mapDashUser(user as unknown as Record<string, unknown>),
            sessionsCount: Array.isArray(raw.session)
              ? raw.session.length
              : undefined,
            accountsCount: Array.isArray(raw.account)
              ? raw.account.length
              : undefined,
          });
        } catch (e) {
          if (isNotFoundError(e)) {
            return toolResult({ found: false, user: null });
          }
          return toolError(`Failed to get user: ${dashErrorMessage(e)}`);
        }
      },
  });
}
