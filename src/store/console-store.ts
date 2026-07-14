import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Persisted history + favourites for the manual API console. */

export interface ConsoleEntry {
  id: string;
  method: 'GET' | 'POST';
  /** GET: command name(s). POST: goformId. */
  target: string;
  /** POST params as `k=v&k2=v2`. */
  params: string;
  at: number;
}

interface ConsoleState {
  history: ConsoleEntry[];
  favorites: ConsoleEntry[];
  pushHistory: (entry: Omit<ConsoleEntry, 'id' | 'at'>) => void;
  addFavorite: (entry: Omit<ConsoleEntry, 'id' | 'at'>) => void;
  removeFavorite: (id: string) => void;
  clearHistory: () => void;
}

const MAX_HISTORY = 50;
const newId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      history: [],
      favorites: [],
      pushHistory: (entry) =>
        set((s) => {
          const history = [{ ...entry, id: newId(), at: Date.now() }, ...s.history];
          if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
          return { history };
        }),
      addFavorite: (entry) =>
        set((s) => ({ favorites: [{ ...entry, id: newId(), at: Date.now() }, ...s.favorites] })),
      removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'zrm.console' },
  ),
);
