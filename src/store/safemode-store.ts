import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Safe Mode: a commit/rollback guard for risky lock actions.
 *
 * When a band/cell lock is applied, Safe Mode is "armed" with a deadline. A
 * watchdog then checks connectivity; if the link doesn't recover within the
 * timeout, it automatically reverts everything to auto (unlock all). The armed
 * state is persisted so that even if the router drops/reboots, the app can still
 * revert on the next reconnect.
 */

export interface ArmedState {
  since: number;
  deadline: number;
  label: string;
}

interface SafeModeState {
  enabled: boolean;
  timeoutSec: number;
  armed: ArmedState | null;
  /** Set when the watchdog auto-reverts, so the UI can notify the user. */
  lastRevert: { at: number; label: string } | null;
  setEnabled: (enabled: boolean) => void;
  setTimeoutSec: (sec: number) => void;
  arm: (label: string) => void;
  disarm: () => void;
  markReverted: (label: string) => void;
  clearRevertNotice: () => void;
}

export const useSafeModeStore = create<SafeModeState>()(
  persist(
    (set, get) => ({
      enabled: true,
      timeoutSec: 60,
      armed: null,
      lastRevert: null,
      setEnabled: (enabled) => set({ enabled, armed: enabled ? get().armed : null }),
      setTimeoutSec: (timeoutSec) => set({ timeoutSec: Math.max(15, timeoutSec) }),
      arm: (label) => {
        if (!get().enabled) return;
        const now = Date.now();
        set({ armed: { since: now, deadline: now + get().timeoutSec * 1000, label } });
      },
      disarm: () => set({ armed: null }),
      markReverted: (label) => set({ armed: null, lastRevert: { at: Date.now(), label } }),
      clearRevertNotice: () => set({ lastRevert: null }),
    }),
    {
      name: 'zrm.safemode',
      partialize: (s) => ({ enabled: s.enabled, timeoutSec: s.timeoutSec, armed: s.armed }),
    },
  ),
);
