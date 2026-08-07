import { useFetchClient } from "@strapi/strapi/admin";
import { useQuery } from "react-query";

export interface PluginSettings {
  /**
   * Absolute URL of the public-facing client app. Used as the callback
   * destination for email verification / password reset links sent from
   * the dashboard, instead of falling back to the admin panel URL.
   */
  email_callback_url?: string;
}

export function usePluginSettings() {
  const { get } = useFetchClient();

  return useQuery<PluginSettings, Error>({
    queryKey: ["dash-plugin-settings"],
    queryFn: async () => {
      const { data } = await get<PluginSettings>(
        "/better-auth-dashboard/settings",
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
