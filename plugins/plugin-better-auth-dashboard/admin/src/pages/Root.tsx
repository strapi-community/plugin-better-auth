import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { ProtectedApp } from "./App";

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
      <ProtectedApp />
    </QueryClientProvider>
  );
}

export default Root;
