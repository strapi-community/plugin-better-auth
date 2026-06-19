import { Alert, Box, Flex, Loader } from "@strapi/design-system";
import { BackButton, Layouts, Page } from "@strapi/strapi/admin";
import { useQuery } from "react-query";
import { Outlet } from "react-router-dom";
import { client } from "../client";
import { Nav } from "../components/Nav";
import { hasPlugin, useDashConfig } from "../hooks/useDashConfig";

const RESPONSIVE_DEFAULT_SPACING = {
  initial: 4,
  medium: 6,
  large: 10,
};

export function App() {
  const { data: config, isLoading, isError, error } = useDashConfig();

  const orgEnabled = hasPlugin(config, "organization");

  const orgOptionsQuery = useQuery({
    queryKey: ["dash-org-options"],
    queryFn: async () => {
      const result = await client.dash.organization.options();
      if (result.error) return { teamsEnabled: false };
      return result.data ?? { teamsEnabled: false };
    },
    enabled: orgEnabled,
  });

  const teamsEnabled = orgEnabled
    ? (orgOptionsQuery.data?.teamsEnabled ?? false)
    : false;

  if (isLoading) {
    return (
      <Flex justifyContent="center" alignItems="center" padding={12}>
        <Loader>Loading Better Auth dashboard…</Loader>
      </Flex>
    );
  }

  if (isError) {
    return (
      <Box padding={6}>
        <Alert
          closeLabel="Close"
          title="Error loading configuration"
          variant="danger"
        >
          {(error as Error)?.message}
        </Alert>
      </Box>
    );
  }

  if (!config) return null;

  return (
    <div
      data-testid="dashboard-root"
      style={{ display: "flex", flex: "1 1 auto", minHeight: "100vh" }}
    >
      <Layouts.Root sideNav={<Nav orgEnabled={orgEnabled} />}>
        <Page.Title>Authentication</Page.Title>
        <Box
          display={{ initial: "block", medium: "none" }}
          paddingLeft={RESPONSIVE_DEFAULT_SPACING}
          paddingRight={RESPONSIVE_DEFAULT_SPACING}
          paddingTop={RESPONSIVE_DEFAULT_SPACING}
        >
          <BackButton fallback="/plugins/better-auth-dashboard" />
        </Box>
        <Outlet context={{ config, teamsEnabled }} />
      </Layouts.Root>
    </div>
  );
}
