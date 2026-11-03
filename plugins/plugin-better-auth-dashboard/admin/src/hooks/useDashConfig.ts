import { type IntlShape, useIntl } from "react-intl";
import { useQuery } from "react-query";
import { client } from "../client";
import { getTranslation } from "../utils/getTranslation";

type RawConfig = Awaited<ReturnType<typeof client.dash.config>>;
export type DashConfig = NonNullable<RawConfig["data"]>;

const loadConfigError = {
  id: getTranslation("common.errors.loadConfig"),
  defaultMessage: "Failed to load config",
};

/**
 * `formatMessage` is optional because this is also called outside React
 * (e.g. link availability checks at register time).
 */
export async function getDashConfig(
  formatMessage?: IntlShape["formatMessage"],
): Promise<DashConfig> {
  const result = await client.dash.config();
  if (result.error) {
    throw new Error(
      result.error.message ??
        (formatMessage
          ? formatMessage(loadConfigError)
          : loadConfigError.defaultMessage),
    );
  }
  return result.data as DashConfig;
}

export function useDashConfig() {
  const { formatMessage } = useIntl();

  return useQuery<DashConfig, Error>({
    queryKey: ["dash-config"],
    queryFn: () => getDashConfig(formatMessage),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrganizationOptions(enabled = true) {
  return useQuery({
    queryKey: ["dash-org-options"],
    queryFn: async () => {
      const result = await client.dash.organization.options();
      if (result.error) return { teamsEnabled: false };
      return result.data ?? { teamsEnabled: false };
    },
    enabled,
  });
}

/**
 * Returns whether a plugin with the given ID is installed.
 */
export function hasPlugin(config: DashConfig | undefined, id: string): boolean {
  return config?.plugins.some((p: { id: string }) => p.id === id) ?? false;
}
