import { z } from "@strapi/utils";
import { ACTION, USER_UID } from "../constants";
import {
  docs,
  type McpRegistrar,
  mapUser,
  toolResult,
  userOutput,
} from "../shared";

/**
 * `better_auth_list_users` — list and filter Better Auth users.
 *
 * Reads go through the Strapi document service so the tool works regardless of
 * which Better Auth plugins the consumer enabled.
 */
export function registerListUsers(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_list_users",
    title: "List Better Auth users",
    description:
      "List and filter the Better Auth users managed by Strapi. Supports a case-insensitive search over name and email, filtering by banned status, pagination and sorting.",
    auth: { policies: [{ action: ACTION.USER_READ }] },
    resolveInputSchema: () =>
      z.object({
        search: z
          .string()
          .optional()
          .describe("Case-insensitive substring matched against name or email"),
        banned: z
          .boolean()
          .optional()
          .describe(
            "Only return banned (true) or non-banned (false) users; requires the Better Auth admin plugin",
          ),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        sort: z
          .string()
          .default("createdAt:desc")
          .describe(
            "Strapi sort expression, e.g. 'createdAt:desc' or 'email:asc'",
          ),
      }),
    resolveOutputSchema: () =>
      z.object({
        total: z.number(),
        count: z.number(),
        users: z.array(userOutput),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { search, banned, limit, offset, sort } = args;

        const filters: Record<string, unknown> = {};
        if (search) {
          filters.$or = [
            { name: { $containsi: search } },
            { email: { $containsi: search } },
          ];
        }
        if (typeof banned === "boolean") {
          filters.banned = banned;
        }

        const service = docs(strapi, USER_UID);
        const [users, total] = await Promise.all([
          service.findMany({ filters, sort, limit, start: offset }),
          service.count({ filters }),
        ]);

        return toolResult({
          total,
          count: users.length,
          users: users.map(mapUser),
        });
      },
  });
}
