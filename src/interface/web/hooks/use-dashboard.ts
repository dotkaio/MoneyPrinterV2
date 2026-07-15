import useSWR from "swr";

import { apiRequest } from "@/lib/api";
import type { DashboardOverview } from "../../dashboard-contract";

interface DashboardState {
  overview: DashboardOverview | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(): DashboardState {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    DashboardOverview,
    Error
  >("/api/overview", apiRequest, {
    refreshInterval: 15_000,
    refreshWhenHidden: false,
  });

  return {
    overview: data ?? null,
    error: error instanceof Error ? error.message : null,
    loading: isLoading,
    refreshing: isValidating,
    refresh: async () => {
      await mutate();
    },
  };
}
