import { z } from "@strapi/utils";
import { ACTION, SESSION_UID, USER_UID } from "../constants";
import {
  docs,
  type McpRegistrar,
  mapUser,
  query,
  toolResult,
  type UserOut,
  userOutput,
} from "../shared";

/**
 * `better_auth_ban_user` / `better_auth_unban_user`.
 *
 * Ban state lives on the Better Auth `user` table (added by the admin plugin),
 * so these tools are only registered when that attribute exists. Banning also
 * revokes the user's active sessions, mirroring Better Auth's own ban behaviour.
 */
export function registerBanTools(mcp: McpRegistrar) {
  mcp.registerTool({
    name: "better_auth_ban_user",
    title: "Ban a Better Auth user",
    description:
      "Ban (block) a Better Auth user by documentId. Optionally record a reason and an expiry (seconds from now). All of the user's active sessions are revoked.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        documentId: z.string().describe("The Strapi documentId of the user"),
        banReason: z.string().optional(),
        banExpiresIn: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Seconds from now until the ban expires; omit for a permanent ban",
          ),
      }),
    resolveOutputSchema: () =>
      z.object({
        banned: z.boolean(),
        revokedSessions: z.number(),
        user: userOutput.nullable(),
        message: z.string().optional(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const { documentId, banReason, banExpiresIn } = args;

        const user = await docs(strapi, USER_UID).update({
          documentId,
          data: {
            banned: true,
            banReason: banReason ?? null,
            banExpires: banExpiresIn
              ? new Date(Date.now() + banExpiresIn * 1000)
              : null,
          },
        });

        if (!user) {
          return toolResult({
            banned: false,
            revokedSessions: 0,
            user: null as UserOut | null,
            message: "User not found.",
          });
        }

        const { count } = await query(strapi, SESSION_UID).deleteMany({
          where: { userId: user.id },
        });

        return toolResult({
          banned: true,
          revokedSessions: count ?? 0,
          user: mapUser(user),
        });
      },
  });

  mcp.registerTool({
    name: "better_auth_unban_user",
    title: "Unban a Better Auth user",
    description: "Lift the ban on a Better Auth user by documentId.",
    auth: { policies: [{ action: ACTION.USER_UPDATE }] },
    resolveInputSchema: () =>
      z.object({
        documentId: z.string().describe("The Strapi documentId of the user"),
      }),
    resolveOutputSchema: () =>
      z.object({
        unbanned: z.boolean(),
        user: userOutput.nullable(),
        message: z.string().optional(),
      }),
    createHandler:
      (strapi) =>
      async ({ args }) => {
        const user = await docs(strapi, USER_UID).update({
          documentId: args.documentId,
          data: { banned: false, banReason: null, banExpires: null },
        });

        return toolResult({
          unbanned: Boolean(user),
          user: user ? mapUser(user) : null,
          message: user ? undefined : "User not found.",
        });
      },
  });
}
