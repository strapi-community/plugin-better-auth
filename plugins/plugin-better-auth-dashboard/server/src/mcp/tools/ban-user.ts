import { z } from "@strapi/utils";
import { callDash } from "../../utils/dash";
import { ACTION } from "../constants";
import { type McpRegistrar, toolError, toolResult } from "../shared";

/**
 * `better_auth_ban_user` / `better_auth_unban_user` via the dash() plugin.
 *
 * Banning runs Better Auth's own ban logic (including session revocation). Only
 * registered when the admin plugin's `banned` field exists on the user schema,
 * matching the dashboard's feature detection.
 */
export function registerBanTools(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_ban_user",
    title: "Ban a Better Auth user",
    description:
      "Ban (block) a Better Auth user by id, through the Better Auth dashboard API. Optionally set a reason and an expiry in days; Better Auth revokes the user's sessions.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        userId: z.string().describe("The Better Auth user id"),
        banReason: z.string().optional(),
        banExpiresInDays: z
          .number()
          .positive()
          .optional()
          .describe(
            "Days from now until the ban expires; omit for a permanent ban",
          ),
      }),
    resolveOutputSchema: () => z.object({ banned: z.boolean() }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { userId, banReason, banExpiresInDays } = args;

        const body: { banReason?: string; banExpires?: number } = {};
        if (banReason) body.banReason = banReason;
        if (banExpiresInDays) {
          // dash() expects an absolute epoch-ms timestamp (see the dashboard UI).
          body.banExpires = Date.now() + banExpiresInDays * 86400000;
        }

        const { ok, data } = await callDash(strapi, {
          path: "ban-user",
          method: "POST",
          context: { userId },
          body,
        });

        if (!ok)
          return toolError(`Failed to ban user: ${JSON.stringify(data)}`);
        return toolResult({ banned: true });
      },
  });

  mcp.registerTool({
    name: "better_auth_unban_user",
    title: "Unban a Better Auth user",
    description:
      "Lift the ban on a Better Auth user by id, through the Better Auth dashboard API.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({ userId: z.string().describe("The Better Auth user id") }),
    resolveOutputSchema: () => z.object({ unbanned: z.boolean() }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { ok, data } = await callDash(strapi, {
          path: "unban-user",
          method: "POST",
          context: { userId: args.userId },
        });

        if (!ok)
          return toolError(`Failed to unban user: ${JSON.stringify(data)}`);
        return toolResult({ unbanned: true });
      },
  });
}
