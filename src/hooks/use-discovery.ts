import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/store';
import { runDiscovery } from '@/reverse/engine';
import { latestSnapshot } from '@/reverse/cache';
import { seedOnlyDatabase } from '@/reverse/database';
import type { ApiDatabase } from '@/types';

/**
 * Reverse-engineering hooks. `useApiDatabase` returns the current best database
 * (cached snapshot, or seed-only before the first scan). `useRunDiscovery`
 * triggers a live crawl+parse and refreshes the cache.
 */

export function useApiDatabase() {
  return useQuery<ApiDatabase>({
    queryKey: ['api-database'],
    queryFn: async () => latestSnapshot() ?? seedOnlyDatabase(),
    staleTime: Infinity,
  });
}

export function useRunDiscovery() {
  const queryClient = useQueryClient();
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const firmware = useConnectionStore((s) => s.device?.firmware ?? undefined);

  return useMutation({
    mutationFn: () => runDiscovery({ baseUrl, firmware: firmware ?? undefined }),
    onSuccess: (result) => {
      queryClient.setQueryData(['api-database'], result.database);
    },
  });
}
