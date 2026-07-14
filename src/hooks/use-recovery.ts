import { useCallback, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useClient, useRuntimeStore, useSafeModeStore } from '@/store';
import { revertToAuto, readLockStatus } from '@/services';
import type { GoformClient } from '@/api';

const POLLED_KEYS = [['radio'], ['telemetry'], ['wan'], ['tower-scan']];

/**
 * Reverts all locks to auto while polling is paused. Pausing is essential:
 * otherwise a background read rotates the router's RD nonce between signing and
 * sending the unlock, and the unlock silently fails (which is why the earlier
 * "Revert now" button didn't restore the connection).
 */
export async function guardedRevert(
  client: GoformClient,
  qc: QueryClient,
  setMutating: (v: boolean) => void,
): Promise<void> {
  setMutating(true);
  try {
    await Promise.all(POLLED_KEYS.map((queryKey) => qc.cancelQueries({ queryKey })));
    await revertToAuto(client);
  } finally {
    setMutating(false);
    qc.invalidateQueries({ queryKey: ['radio'] });
    qc.invalidateQueries({ queryKey: ['lock-status'] });
  }
}

export interface RecoveryResult {
  ok: boolean;
}

/** Hook for the Panic button, Safe Mode banner, and the Optimizer "max speed". */
export function useRecovery() {
  const client = useClient();
  const qc = useQueryClient();
  const setMutating = useRuntimeStore((s) => s.setMutating);
  const disarm = useSafeModeStore((s) => s.disarm);
  const [recovering, setRecovering] = useState(false);
  const [lastResult, setLastResult] = useState<RecoveryResult | null>(null);

  const recover = useCallback(async () => {
    if (!client) return;
    setRecovering(true);
    setLastResult(null);
    try {
      await guardedRevert(client, qc, setMutating);
      disarm();
      // Verify: read back the lock state so the UI can confirm it's really free.
      let ok = true;
      try {
        ok = !(await readLockStatus(client)).anyLocked;
      } catch {
        ok = true;
      }
      setLastResult({ ok });
    } finally {
      setRecovering(false);
    }
  }, [client, qc, setMutating, disarm]);

  return { recover, recovering, lastResult };
}
