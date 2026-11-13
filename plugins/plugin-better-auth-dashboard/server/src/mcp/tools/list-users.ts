import { z } from "@strapi/utils";
import { callDash } from "../../utils/dash";
import { ACTION } from "../constants";
import {
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

        const { ok, data } = await callDash(strapi, {
          path: "list-users",
          method: "GET",
          query: {
            limit,
            offset,
            sortBy: "createdAt",
            sortOrder: "desc",
            where,
          },
        });

        if (!ok)
          return toolError(`Failed to list users: ${JSON.stringify(data)}`);

        const body = data as {
          users?: Record<string, unknown>[];
          total?: number;
          onlineUsers?: number;
        };
        const users = (body.users ?? []).map(mapDashUser);

        return toolResult({
          total: body.total ?? users.length,
          count: users.length,
          onlineUsers: body.onlineUsers,
          users,
        });
      },
  });
}
