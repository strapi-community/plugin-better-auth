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
        const body: {
          name?: string;
          email?: string;
          image?: string;
          emailVerified?: boolean;
        } = {};
        if (args.name !== undefined) body.name = args.name;
        if (args.email !== undefined) body.email = args.email;
        if (args.image !== undefined) body.image = args.image;
        if (args.emailVerified !== undefined)
          body.emailVerified = args.emailVerified;

        if (Object.keys(body).length === 0) {
          return toolError("No fields to update were provided.");
        }

        try {
          const { auth, headers } = await getDashApi(strapi, {
            userId: args.userId,
          });
          const user = await auth.api.updateDashUser({ body, headers });

          return toolResult({
            updated: true,
            user: mapDashUser(user as unknown as Record<string, unknown>),
          });
        } catch (e) {
          return toolError(`Failed to update user: ${dashErrorMessage(e)}`);
        }
      },
  });
}
