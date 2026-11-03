import { PLUGIN_ID } from "../pluginId";

const prefixPluginTranslations = (
  translations: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [
      `${PLUGIN_ID}.${key}`,
      value,
    ]),
  );

export { prefixPluginTranslations };
