import { useQuery } from "react-query";
import { client } from "../client";

type RawConfig = Awaited<ReturnType<typeof client.dash.config>>;
export type DashConfig = NonNullable<RawConfig["data"]>;

export async function getDashConfig(): Promise<DashConfig> {
  const result = await client.dash.config();
  if (result.error) {
    throw new Error(result.error.message ?? "Failed to load config");
  }
  return result.data as DashConfig;
}

export function useDashConfig() {
  return useQuery<DashConfig, Error>({
    queryKey: ["dash-config"],
    queryFn: getDashConfig,
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
