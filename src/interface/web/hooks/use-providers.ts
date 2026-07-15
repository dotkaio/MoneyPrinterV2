import useSWR from "swr";

import { apiRequest } from "@/lib/api";
import type { AiProviderConnectionDto } from "../../dashboard-contract";

interface ConnectProviderInput {
  kind: AiProviderConnectionDto["kind"];
  apiKey?: string;
  model: string;
}

interface ProvidersState {
  providers: readonly AiProviderConnectionDto[];
  activeProvider: AiProviderConnectionDto | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  connect: (input: ConnectProviderInput) => Promise<AiProviderConnectionDto>;
  disconnect: (kind: AiProviderConnectionDto["kind"]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProviders(): ProvidersState {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    readonly AiProviderConnectionDto[],
    Error
  >("/api/providers", apiRequest);
  const providers = data ?? [];

  return {
    providers,
    activeProvider:
      providers.find((provider) => provider.connected && provider.active) ??
      null,
    error: error instanceof Error ? error.message : null,
    loading: isLoading,
    refreshing: isValidating,
    connect: async (input) => {
      const connection = await apiRequest<AiProviderConnectionDto>(
        "/api/providers",
        { method: "POST", body: JSON.stringify(input) },
      );
      await mutate();
      return connection;
    },
    disconnect: async (kind) => {
      await apiRequest<undefined>(`/api/providers/${kind}`, {
        method: "DELETE",
      });
      await mutate();
    },
    refresh: async () => {
      await mutate();
    },
  };
}
