import { useQuery } from '@tanstack/react-query';
import { useClient } from '@/store';
import { readRadioSnapshot, scanTowers } from '@/services';

/** Tower scan: reads the live snapshot then enriches it with neighbour cells. */
export function useTowerScan(enabled = true, refetchInterval: number | false = false) {
  const client = useClient();
  return useQuery({
    queryKey: ['tower-scan'],
    queryFn: async () => {
      const snapshot = await readRadioSnapshot(client!);
      return scanTowers(client!, snapshot);
    },
    enabled: !!client && enabled,
    refetchInterval,
  });
}
