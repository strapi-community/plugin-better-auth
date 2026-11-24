import type { Core } from "@strapi/strapi";

/**
 * Whether this admin could read `uid` in the Content Manager. Uses the Content
 * Manager's own permission checker, which also resolves action aliases (e.g.
 * `plugin::api-permissions.roles.read` → `plugin::content-manager.explorer.read`),
 * so the answer matches what the Content Manager itself would show.
 */
export function canReadInContentManager(
  strapi: Core.Strapi,
  userAbility: unknown,
  uid: string,
): boolean {
  if (!userAbility || !(uid in strapi.contentTypes)) return false;
  const checker = strapi
    .plugin("content-manager")
    .service("permission-checker")
    .create({ userAbility, model: uid }) as { can: { read: () => boolean } };
  return checker.can.read();
}
