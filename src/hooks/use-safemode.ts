import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectionStore, useRuntimeStore, useSafeModeStore } from '@/store';
import { isConnectionHealthy } from '@/services';
import { guardedRevert } from './use-recovery';

const CHECK_INTERVAL_MS = 5000;

/**
 * Safe Mode watchdog. Mounted once at the app root. While a risky lock is
 * "armed", it periodically checks connectivity:
 *   - healthy again  → disarm (the change is confirmed good),
 *   - still down past the deadline → revert everything to auto (polling paused
 *     during the revert so the RD signature stays valid).
 *
 * It skips ticks while a mutation is in flight and keeps trying across a router
 * reboot until the link either recovers or is successfully reverted.
 */
export function useSafeModeWatchdog(): void {
  const client = useConnectionStore((s) => s.client);
  const qc = useQueryClient();
  const busy = useRef(false);

  useEffect(() => {
    if (!client) return;
    const tick = async () => {
      const { armed, enabled, markReverted, disarm } = useSafeModeStore.getState();
      const { mutating, setMutating } = useRuntimeStore.getState();
      if (!enabled || !armed || busy.current || mutating) return;

      busy.current = true;
      try {
        if (await isConnectionHealthy(client)) {
          disarm();
        } else if (Date.now() >= armed.deadline) {
          await guardedRevert(client, qc, setMutating);
          markReverted(armed.label);
        }
      } catch {
        /* transient — retry next tick */
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    void tick();
    return () => clearInterval(id);
  }, [client, qc]);
}
