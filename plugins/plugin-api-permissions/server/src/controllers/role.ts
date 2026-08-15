import { factories } from "@strapi/strapi";
import { ROLE_UID } from "../utils";

export default factories.createCoreController(ROLE_UID, ({ strapi }) => {
  const service = strapi.plugin("api-permissions").service("permission");

  return {
    async create(ctx) {
      const body = (ctx.request.body as { data: Record<string, unknown> }) || {
        data: {},
      };

      if (!body) return super.create(ctx);

      const { permissions = {}, ...rest } = body.data;
      body.data = rest;

      const result = await super.create(ctx);

      const actions = service.extractActionsFromPermissions(permissions);
      await service.connectRolesToPermissions(
        result.data.documentId,
        actions || [],
      );

      return result;
    },

    async update(ctx) {
      const body = (ctx.request.body as { data: Record<string, unknown> }) || {
        data: {},
      };

      if (!body) return super.update(ctx);

      const { permissions, ...rest } = body.data;
      body.data = rest;

      const result = await super.update(ctx);

      if (permissions !== undefined) {
        const actions = service.extractActionsFromPermissions(permissions);
        await service.connectRolesToPermissions(ctx.params.id, actions);
      }

      return result;
    },
  };
});
