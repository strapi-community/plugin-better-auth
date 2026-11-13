import { z } from "@strapi/utils";
import { ACTION, USER_UID } from "../constants";
import {
  docs,
  type McpRegistrar,
  mapUser,
  toolResult,
  type UserOut,
  userOutput,
} from "../shared";

/**
 * `better_auth_update_user` — update a user's basic profile fields.
 *
 * Writes go through the document service (the same path the dashboard's generic
 * db-controller uses). Ban state and roles have dedicated tools so their side
 * effects are explicit.
 */
export function registerUpdateUser(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_update_user",
    title: "Update a Better Auth user",
    description:
      "Update a Better Auth user's basic profile fields (name, email, emailVerified) by documentId. Use the ban and role tools for ban state and roles.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        documentId: z.string().describe("The Strapi documentId of the user"),
        name: z.string().optional(),
        email: z.string().email().optional(),
        emailVerified: z.boolean().optional(),
      }),
    resolveOutputSchema: () =>
      z.object({
        updated: z.boolean(),
        user: userOutput.nullable(),
        message: z.string().optional(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { documentId, ...rest } = args as Record<string, unknown>;
        const data = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== undefined),
        );

        if (Object.keys(data).length === 0) {
          return toolResult({
            updated: false,
            user: null as UserOut | null,
            message: "No fields to update were provided.",
          });
        }

        const user = await docs(strapi, USER_UID).update({ documentId, data });

        return toolResult({
          updated: Boolean(user),
          user: user ? mapUser(user) : null,
          message: user ? undefined : "User not found.",
        });
      },
  });
}
