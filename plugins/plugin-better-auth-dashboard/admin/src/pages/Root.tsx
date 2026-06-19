import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";
import type { DashConfig } from "../hooks/useDashConfig";
import { App } from "./App";
import { OrganizationsPage } from "./Organizations";
import { OverviewPage } from "./Overview";
import { UsersPage } from "./Users";

function UsersRoute() {
  const { config } = useOutletContext<{ config: DashConfig }>();
  return <UsersPage config={config} />;
}

function OrganizationsRoute() {
  const { teamsEnabled } = useOutletContext<{ teamsEnabled: boolean }>();
  return <OrganizationsPage teamsEnabled={teamsEnabled} />;
}

/**
 * Root component that provides the React Query client.
 * A stable QueryClient instance is created once per mount via useMemo
 * to avoid re-creating it on re-renders.
 */
export function Root() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="users" element={<UsersRoute />} />
          <Route path="organizations" element={<OrganizationsRoute />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}

export default Root;
