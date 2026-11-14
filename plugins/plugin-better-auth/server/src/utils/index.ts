import packageJson from "../../../package.json";
import type config from "../";

export const PLUGIN_ID = packageJson.strapi.name;

export const POSSIBLE_CONFIG_LOCATIONS = [
  "auth.js",
  "lib/auth.js",
  "src/lib/auth.js",
];

export const MIN_STRAPI_VERSION = "5.45.0";

/**
 * Whether the one-time migration from `users-permissions` is enabled, via the
 * `migration.enabled` plugin config or the `BETTER_AUTH_MIGRATE_FROM_USERS_PERMISSIONS`
 * env var. While enabled, the plugin is allowed to boot alongside users-permissions.
 */
export const isMigrationEnabled = (): boolean =>
  Boolean(strapi.config.get(`plugin::${PLUGIN_ID}.migration.enabled`, false)) ||
  process.env.BETTER_AUTH_MIGRATE_FROM_USERS_PERMISSIONS === "true";

export function isVersionAtLeast(version: string, minimum: string): boolean {
  // Experimental builds (e.g. 0.0.0-experimental.<hash>) are always treated as satisfying
  if (version.includes("-experimental.")) return true;

  const parse = (v: string) => v.split(".").map(Number);
  const [maj, min, pat] = parse(version);
  const [minMaj, minMin, minPat] = parse(minimum);
  if (maj !== minMaj) return maj > minMaj;
  if (min !== minMin) return min > minMin;
  return pat >= minPat;
}

type Config = typeof config;
type Services = Config["services"];
/**
 * A helper function to obtain a plugin service.
 * @param {string} name The name of the service.
 *
 * @return {any} service.
 */
export const getPluginService = <ServiceName extends keyof Services>(
  name: ServiceName,
): ReturnType<Services[ServiceName]> => {
  const service = strapi.service(`plugin::${PLUGIN_ID}.${name}`);
  return service as ReturnType<Services[ServiceName]>;
};
