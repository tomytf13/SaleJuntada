import { useCallback, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  gatheringService,
  type Gathering,
} from "../services/gatheringService";

export const gatheringKey = (slug: string, token?: string) =>
  ["gathering", slug, token ?? "public"] as const;

export function useGathering(slug: string, token?: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: gatheringKey(slug, token),
    queryFn: () => gatheringService.getBySlug(slug, token),
    enabled: Boolean(slug),
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 1,
    // También recupera cambios perdidos si la conexión en vivo está caída.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const setGathering = useCallback(
    (next: SetStateAction<Gathering | null>) => {
      client.setQueryData<Gathering>(gatheringKey(slug, token), (current) => {
        const value = typeof next === "function" ? next(current ?? null) : next;
        return value ?? undefined;
      });
    },
    [client, slug, token],
  );
  const refresh = useCallback(
    () =>
      client.invalidateQueries({
        queryKey: gatheringKey(slug, token),
        exact: true,
      }),
    [client, slug, token],
  );
  return {
    ...query,
    gathering: query.data ?? null,
    setGathering,
    refresh,
  };
}
