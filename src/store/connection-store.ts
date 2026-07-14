import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GoformClient } from '@/api';
import { isNativePlatform, DEFAULT_ROUTER_URL } from '@/api/transport';
import type { DeviceInfo } from '@/types';
import { readDeviceInfo, login as apiLogin, type LoginResult } from '@/services';
import { resolveRouter, type ResolvedRouter } from '@/plugins';
import { devLogSink } from './devlog-store';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectionState {
  baseUrl: string;
  status: ConnectionStatus;
  error: string | null;
  device: DeviceInfo | null;
  router: ResolvedRouter | null;
  /**
   * True when the router session is authenticated (cr_version is readable).
   * Privileged reads (signal/cell) and all lock actions require this.
   */
  loggedIn: boolean;
  /** Non-persisted live client instance. */
  client: GoformClient | null;

  setBaseUrl: (baseUrl: string) => void;
  connect: () => Promise<void>;
  /** Authenticate against the router (SHA-256 login). Connects first if needed. */
  login: (password: string) => Promise<LoginResult>;
  disconnect: () => void;
  /** Re-read device identity + re-resolve the plugin (after firmware change). */
  refreshIdentity: () => Promise<void>;
}

function createClient(baseUrl: string): GoformClient {
  // On native there is no proxy, so talk to the router directly. Fall back to the
  // default router address when the user hasn't set one.
  const effectiveBaseUrl = isNativePlatform() ? baseUrl || DEFAULT_ROUTER_URL : baseUrl;
  return new GoformClient({ baseUrl: effectiveBaseUrl, onTraffic: devLogSink });
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      baseUrl: '',
      status: 'disconnected',
      error: null,
      device: null,
      router: null,
      loggedIn: false,
      client: null,

      setBaseUrl: (baseUrl) => set({ baseUrl }),

      connect: async () => {
        set({ status: 'connecting', error: null });
        try {
          const client = createClient(get().baseUrl);
          const device = await readDeviceInfo(client);
          const router = resolveRouter(device);
          client.setAuthStrategy(router.authStrategy);
          // cr_version is only readable on an authenticated session.
          const loggedIn = !!(await client.getValue('cr_version'));
          set({ client, device, router, loggedIn, status: 'connected', error: null });
        } catch (err) {
          set({
            status: 'error',
            error: err instanceof Error ? err.message : 'Connection failed',
            client: null,
          });
        }
      },

      login: async (password) => {
        if (!get().client) await get().connect();
        const client = get().client;
        if (!client) return { ok: false, code: undefined };
        const result = await apiLogin(client, password);
        if (result.ok) {
          // Re-read identity now that privileged fields are available.
          const device = await readDeviceInfo(client);
          const router = resolveRouter(device);
          client.setAuthStrategy(router.authStrategy);
          set({ device, router, loggedIn: true, status: 'connected', error: null });
        }
        return result;
      },

      refreshIdentity: async () => {
        const client = get().client;
        if (!client) return;
        const device = await readDeviceInfo(client);
        const router = resolveRouter(device);
        client.setAuthStrategy(router.authStrategy);
        const loggedIn = !!(await client.getValue('cr_version'));
        set({ device, router, loggedIn });
      },

      disconnect: () =>
        set({
          status: 'disconnected',
          client: null,
          device: null,
          router: null,
          loggedIn: false,
          error: null,
        }),
    }),
    {
      name: 'zrm.connection',
      // Only the address is durable; live instances are recreated on connect.
      partialize: (state) => ({ baseUrl: state.baseUrl }),
    },
  ),
);

/** Convenience selector used widely: throws-free access to the live client. */
export function useClient(): GoformClient | null {
  return useConnectionStore((s) => s.client);
}
