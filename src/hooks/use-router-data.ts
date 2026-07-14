import { useQuery } from '@tanstack/react-query';
import { useClient, useRuntimeStore } from '@/store';
import { readDeviceInfo, readTelemetry, readWan, readRadioSnapshot } from '@/services';

/**
 * Query hooks for read-only router data. Each is disabled until a client
 * exists, and keys are namespaced so the live monitor and dashboard share the
 * radio snapshot cache instead of double-polling. Polling is suspended while a
 * mutation is in flight so it can't rotate the RD nonce mid-signature.
 */

export function useDeviceInfo() {
  const client = useClient();
  return useQuery({
    queryKey: ['device'],
    queryFn: () => readDeviceInfo(client!),
    enabled: !!client,
    staleTime: 60_000,
  });
}

export function useTelemetry(refetchInterval = 5_000) {
  const client = useClient();
  const mutating = useRuntimeStore((s) => s.mutating);
  return useQuery({
    queryKey: ['telemetry'],
    queryFn: () => readTelemetry(client!),
    enabled: !!client,
    refetchInterval: mutating ? false : refetchInterval,
  });
}

export function useWan() {
  const client = useClient();
  const mutating = useRuntimeStore((s) => s.mutating);
  return useQuery({
    queryKey: ['wan'],
    queryFn: () => readWan(client!),
    enabled: !!client,
    refetchInterval: mutating ? false : 10_000,
  });
}

export function useRadioSnapshot(refetchInterval: number | false = 1_000) {
  const client = useClient();
  const mutating = useRuntimeStore((s) => s.mutating);
  return useQuery({
    queryKey: ['radio'],
    queryFn: () => readRadioSnapshot(client!),
    enabled: !!client,
    refetchInterval: mutating ? false : refetchInterval,
  });
}
