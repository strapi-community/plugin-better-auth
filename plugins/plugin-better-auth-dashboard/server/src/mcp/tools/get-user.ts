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
 * `better_auth_get_user` — fetch a single Better Auth user by documentId or email.
 */
export function registerGetUser(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_get_user",
    title: "Get a Better Auth user",
    description:
      "Fetch a single Better Auth user by its Strapi documentId or by email address. Provide exactly one of the two.",
    auth: { policies: [{ action: ACTION.USER_READ }] },
    resolveInputSchema: () =>
      z.object({
        documentId: z
          .string()
          .optional()
          .describe("The Strapi documentId of the user"),
        email: z
          .string()
          .optional()
          .describe("The email address of the user (exact match)"),
      }),
    resolveOutputSchema: () =>
      z.object({
        found: z.boolean(),
        user: userOutput.nullable(),
        message: z.string().optional(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { documentId, email } = args;

        if (!documentId && !email) {
          return toolResult({
            found: false,
            user: null as UserOut | null,
            message: "Provide either documentId or email",
          });
        }

        const service = docs(strapi, USER_UID);
        const user = documentId
          ? await service.findOne({ documentId })
          : await service.findFirst({ filters: { email } });

        return toolResult({
          found: Boolean(user),
          user: user ? mapUser(user) : null,
        });
      },
  });
}
