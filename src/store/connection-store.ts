import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GoformClient } from '@/api';
import { HiLinkClient } from '@/api/hilink-client';
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

function effectiveBaseUrl(baseUrl: string): string {
  // On native there is no proxy, so talk to the router directly. Fall back to the
  // default router address when the user hasn't set one.
  return isNativePlatform() ? baseUrl || DEFAULT_ROUTER_URL : baseUrl;
}

function createClient(baseUrl: string): GoformClient {
  return new GoformClient({ baseUrl: effectiveBaseUrl(baseUrl), onTraffic: devLogSink });
}

/**
 * Protocol detection: ZTE goform first (the app's native protocol), then a
 * Huawei HiLink probe (5G CPE 5 / H155 answers XML on /api). Returns the
 * client that answered together with the identity it reported.
 */
async function detectClient(baseUrl: string): Promise<{ client: GoformClient; device: DeviceInfo }> {
  const zte = createClient(baseUrl);
  try {
    return { client: zte, device: await readDeviceInfo(zte) };
  } catch (zteErr) {
    const hilink = new HiLinkClient({ baseUrl: effectiveBaseUrl(baseUrl), onTraffic: devLogSink });
    try {
      return { client: hilink, device: await readDeviceInfo(hilink) };
    } catch {
      throw zteErr; // neither protocol answered — report the primary error
    }
  }
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
          const { client, device } = await detectClient(get().baseUrl);
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
