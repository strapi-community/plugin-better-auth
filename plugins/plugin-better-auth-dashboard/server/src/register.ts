import type { Core } from "@strapi/types";
import { ACTIONS } from "./constants";

export const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // construct appropriate actions to register based on installed plugins
  const actionsToRegister = [...ACTIONS.overview, ...ACTIONS.user];
  if (strapi.plugin("better-auth").contentTypes?.organization)
    actionsToRegister.push(...ACTIONS.organization);

  // register basic permission actions
  strapi.admin.services.permission.actionProvider.registerMany(
    actionsToRegister,
  );
};
