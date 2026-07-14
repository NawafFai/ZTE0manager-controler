import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * "Remember me" for the router password.
 *
 * Stored in this browser/app's localStorage only (never sent anywhere but the
 * router). It's a convenience for a local, single-user tool — treat the machine
 * as trusted. Unchecking "remember" clears the saved password immediately.
 */
interface CredentialsState {
  remember: boolean;
  password: string;
  setRemember: (remember: boolean) => void;
  save: (password: string) => void;
  clear: () => void;
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set) => ({
      remember: false,
      password: '',
      setRemember: (remember) => set(remember ? { remember } : { remember: false, password: '' }),
      save: (password) => set({ password }),
      clear: () => set({ password: '' }),
    }),
    { name: 'zrm.credentials' },
  ),
);
