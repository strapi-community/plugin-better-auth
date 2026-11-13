import { z } from "@strapi/utils";
import { getDashApi } from "../../utils/dash";
import { ACTION } from "../constants";
import {
  dashErrorMessage,
  dashUserOutput,
  type McpRegistrar,
  mapDashUser,
  toolError,
  toolResult,
} from "../shared";

/**
 * `better_auth_list_users` — list/search Better Auth users via the dash() plugin,
 * mirroring the dashboard Users page (same `where` search on name/email).
 */
export function registerListUsers(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_list_users",
    title: "List Better Auth users",
    description:
      "List and search Better Auth users (via the Better Auth dashboard API). `search` matches name or email, case-insensitively. Returns users plus the total count.",
    auth: { policies: [{ action: ACTION.USER_READ }] },
    resolveInputSchema: () =>
      z.object({
        search: z
          .string()
          .optional()
          .describe("Case-insensitive substring matched against name or email"),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      }),
    resolveOutputSchema: () =>
      z.object({
        total: z.number(),
        count: z.number(),
        onlineUsers: z.number().optional(),
        users: z.array(dashUserOutput),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { search, limit, offset } = args;

        // Mirrors the dashboard's useUsers() search clause.
        const where = search
          ? JSON.stringify([
              {
                field: "email",
                operator: "contains",
                value: search,
                connector: "OR",
              },
              {
                field: "name",
                operator: "contains",
                value: search,
                connector: "OR",
              },
            ])
          : undefined;

        try {
          const { auth, headers } = await getDashApi(strapi);
          const result = await auth.api.getDashUsers({
            query: {
              limit,
              offset,
              sortBy: "createdAt",
              sortOrder: "desc",
              ...(where ? { where } : {}),
            },
            headers,
          });

          const users = (result.users ?? []).map((u) =>
            mapDashUser(u as unknown as Record<string, unknown>),
          );

          return toolResult({
            total: result.total ?? users.length,
            count: users.length,
            onlineUsers: result.onlineUsers,
            users,
          });
        } catch (e) {
          return toolError(`Failed to list users: ${dashErrorMessage(e)}`);
        }
      },
  });
}
