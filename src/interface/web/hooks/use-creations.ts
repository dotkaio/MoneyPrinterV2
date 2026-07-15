import useSWR from "swr";

import { apiRequest } from "@/lib/api";
import type { ContentCreationDto } from "../../dashboard-contract";

interface CreateContentInput {
  format: ContentCreationDto["format"];
  topic: string;
  audience: string;
  tone: string;
  language: string;
}

interface CreationsState {
  creations: readonly ContentCreationDto[];
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  create: (input: CreateContentInput) => Promise<ContentCreationDto>;
  refresh: () => Promise<void>;
}

export function useCreations(): CreationsState {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    readonly ContentCreationDto[],
    Error
  >("/api/creations", apiRequest);

  return {
    creations: data ?? [],
    error: error instanceof Error ? error.message : null,
    loading: isLoading,
    refreshing: isValidating,
    create: async (input) => {
      const creation = await apiRequest<ContentCreationDto>("/api/creations", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await mutate();
      return creation;
    },
    refresh: async () => {
      await mutate();
    },
  };
}
