import { create } from 'zustand';
import type { GoformTrafficEvent } from '@/api';

/**
 * Ring buffer of router traffic for Developer Mode. Bounded so a long-running
 * live monitor can't grow memory without limit.
 */

const MAX_EVENTS = 500;

interface DevLogState {
  events: GoformTrafficEvent[];
  paused: boolean;
  add: (event: GoformTrafficEvent) => void;
  clear: () => void;
  setPaused: (paused: boolean) => void;
}

export const useDevLogStore = create<DevLogState>((set, get) => ({
  events: [],
  paused: false,
  add: (event) => {
    if (get().paused) return;
    set((state) => {
      const events = [event, ...state.events];
      if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
      return { events };
    });
  },
  clear: () => set({ events: [] }),
  setPaused: (paused) => set({ paused }),
}));

/** Module-level sink so the client (created outside React) can push events. */
export function devLogSink(event: GoformTrafficEvent): void {
  useDevLogStore.getState().add(event);
}
