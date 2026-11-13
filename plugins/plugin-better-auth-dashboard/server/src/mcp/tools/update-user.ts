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
 * `better_auth_update_user` — update a user's profile fields via the dash()
 * plugin (same fields as the dashboard: name, email, image, emailVerified).
 */
export function registerUpdateUser(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_update_user",
    title: "Update a Better Auth user",
    description:
      "Update a Better Auth user's profile (name, email, image, emailVerified) by Better Auth user id, through the Better Auth dashboard API. Use the ban tools for ban state.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        userId: z.string().describe("The Better Auth user id"),
        name: z.string().optional(),
        email: z.string().email().optional(),
        image: z.string().optional(),
        emailVerified: z.boolean().optional(),
      }),
    resolveOutputSchema: () =>
      z.object({
        updated: z.boolean(),
        user: dashUserOutput.nullable(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { userId, ...rest } = args as Record<string, unknown>;
        const body = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== undefined),
        );

        if (Object.keys(body).length === 0) {
          return toolError("No fields to update were provided.");
        }

        const { ok, data } = await callDash(strapi, {
          path: "update-user",
          method: "POST",
          context: { userId },
          body,
        });

        if (!ok)
          return toolError(`Failed to update user: ${JSON.stringify(data)}`);

        return toolResult({
          updated: true,
          user: mapDashUser(data as Record<string, unknown>),
        });
      },
  });
}
