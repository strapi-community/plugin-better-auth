import type { Context } from "koa";
import type { Config } from "../config";
import { PLUGIN_ID } from "../utils";

/**
 * Serves this plugin's own server config to the admin panel.
 *
 * Kept separate from the Better Auth `dash()` config (proxied at
 * `/auth/dash/config`) since these are settings for the dashboard plugin
 * itself, not something the Better Auth server knows about.
 */
const settingsController = () => ({
  async get(ctx: Context) {
    ctx.body = strapi.config.get<Config>(`plugin::${PLUGIN_ID}`, {});
  },
});

export default settingsController;
