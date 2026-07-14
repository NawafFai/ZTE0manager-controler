import { create } from 'zustand';

/**
 * Transient runtime flags (not persisted). `mutating` is raised while a
 * state-changing action (band/cell lock, reboot) is in flight so that the
 * background signal pollers pause — otherwise a poll would rotate the router's
 * RD nonce between signing and sending, breaking the AD signature.
 */
interface RuntimeState {
  mutating: boolean;
  setMutating: (v: boolean) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  mutating: false,
  setMutating: (mutating) => set({ mutating }),
}));
