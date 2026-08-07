import type { Core } from "@strapi/types";
import { PLUGIN_ID } from "./utils";

type AliasSubject = {
  /** The dashboard permission subCategory this content type is gated behind. */
  resource: "user" | "organization";
  uid: string;
};

/**
 * Better Auth content types (`user`, `organization`, ...) are hidden from the
 * Content Manager navigation, so Strapi never grants `plugin::content-manager.explorer.*`
 * for them — meaning relation fields pointing at these content types can't resolve
 * a mainField and fall back to displaying the document ID instead of a name.
 *
 * Rather than blanket-granting Content Manager access to everyone, we alias each
 * dashboard permission (`plugin::better-auth-dashboard.<resource>.<action>`) to the
 * matching `plugin::content-manager.explorer.<action>` action, scoped to that
 * resource's content type. Whoever already has the dashboard permission to
 * manage a resource transparently gains the ability to see its name in relation
 * fields elsewhere in the Content Manager — nothing is granted beyond that.
 */
export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const provider = strapi.admin.services.permission.actionProvider;

  // strapi.plugin("better-auth").contentTypes is typed as `{ schema: ContentType }`
  // but at runtime each entry *is* the content type itself (no `.schema` wrapper) —
  // go through strapi.contentTypes directly instead so the UID check is reliable.
  const candidates: AliasSubject[] = [
    { resource: "user", uid: "plugin::better-auth.user" },
    { resource: "organization", uid: "plugin::better-auth.organization" },
  ];

  const subjects = candidates.filter(({ uid }) => uid in strapi.contentTypes);

  for (const { resource, uid } of subjects) {
    for (const action of ["create", "read", "update", "delete"]) {
      const explorerActionId = `plugin::content-manager.explorer.${action}`;
      const dashboardAction = provider.get(
        `plugin::${PLUGIN_ID}.${resource}.${action}`,
      );

      if (!dashboardAction) continue;
      if (!dashboardAction.aliases) dashboardAction.aliases = [];

      const alreadyAliased = dashboardAction.aliases.some(
        ({
          actionId,
          subjects: aliasSubjects,
        }: {
          actionId: string;
          subjects?: string[];
        }) => actionId === explorerActionId && aliasSubjects?.includes(uid),
      );

      if (!alreadyAliased) {
        dashboardAction.aliases.push({
          actionId: explorerActionId,
          subjects: [uid],
        });
      }
    }
  }
};
