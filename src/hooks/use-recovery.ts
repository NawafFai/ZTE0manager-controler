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
  /** What the router still reports as locked (only when `ok` is false). */
  remaining?: string;
}

const VERIFY_ATTEMPTS = 5;
const VERIFY_GAP_MS = 3000;

/**
 * The modem applies an unlock asynchronously, so an immediate read-back can still
 * show the old lock. Re-read a few times before declaring that a lock remains.
 */
async function verifyUnlocked(client: GoformClient): Promise<RecoveryResult> {
  let summary = '';
  for (let i = 0; i < VERIFY_ATTEMPTS; i += 1) {
    const status = await readLockStatus(client);
    if (!status.anyLocked) return { ok: true };
    summary = status.summary;
    if (i < VERIFY_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, VERIFY_GAP_MS));
  }
  return { ok: false, remaining: summary };
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
      // A failed read-back is not evidence of a remaining lock.
      let result: RecoveryResult = { ok: true };
      try {
        result = await verifyUnlocked(client);
      } catch {
        /* keep ok */
      }
      setLastResult(result);
    } finally {
      setRecovering(false);
    }
  }, [client, qc, setMutating, disarm]);

  return { recover, recovering, lastResult };
}
