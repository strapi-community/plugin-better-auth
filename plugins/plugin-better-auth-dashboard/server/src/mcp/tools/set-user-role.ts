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
 * `better_auth_set_user_role` — set a user's Better Auth admin-plugin role.
 *
 * The `role` attribute is added by the Better Auth admin plugin, so this tool is
 * only registered when that attribute exists on the generated `user` content type.
 * Note: this is the Better Auth role (e.g. "admin"/"user"), not the Strapi
 * Content-API role managed by plugin-api-permissions.
 */
export function registerSetUserRole(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_set_user_role",
    title: "Set a Better Auth user's role",
    description:
      "Set the Better Auth admin-plugin role of a user (e.g. 'admin' or 'user') by documentId. This is not the Strapi Content-API role.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        documentId: z.string().describe("The Strapi documentId of the user"),
        role: z.string().describe("The role to assign, e.g. 'admin' or 'user'"),
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
        const user = await docs(strapi, USER_UID).update({
          documentId: args.documentId,
          data: { role: args.role },
        });

        return toolResult({
          updated: Boolean(user),
          user: user ? mapUser(user) : null,
          message: user ? undefined : "User not found.",
        });
      },
  });
}
