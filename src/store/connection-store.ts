import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GoformClient } from '@/api';
import { HiLinkClient } from '@/api/hilink-client';
import { isNativePlatform, CANDIDATE_ROUTER_URLS, DEFAULT_ROUTER_URL } from '@/api/transport';
import { GoformError, type DeviceInfo } from '@/types';
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

/** Shared in-flight connect promise (see connect()). */
let connectInFlight: Promise<void> | null = null;

/** Short timeout for discovery probes — an absent host should fail fast. */
const PROBE_TIMEOUT_MS = 3_500;

interface Detected {
  client: GoformClient;
  device: DeviceInfo;
  /** The address that actually answered ('' = same-origin proxy). */
  url: string;
}

/**
 * Protocol detection at one address: ZTE goform first (the app's native
 * protocol), then a Huawei HiLink probe (5G CPE 5 / H155 answers XML on /api).
 * Returns the client that answered together with the identity it reported.
 */
async function detectAt(baseUrl: string): Promise<Detected> {
  const zte = createClient(baseUrl);
  try {
    return { client: zte, device: await readDeviceInfo(zte), url: baseUrl };
  } catch (zteErr) {
    const hilink = new HiLinkClient({ baseUrl: effectiveBaseUrl(baseUrl), onTraffic: devLogSink });
    try {
      return { client: hilink, device: await readDeviceInfo(hilink), url: baseUrl };
    } catch {
      throw zteErr; // neither protocol answered — report the primary error
    }
  }
}

/**
 * Find the router. On web/Electron requests go through the same-origin proxy,
 * which owns the target address — a single detection attempt is all there is.
 * On native (Android/iOS) the app talks to the router directly, so when the
 * configured address doesn't answer we probe the known factory addresses
 * (ZTE 192.168.0.1 / 192.168.100.1, Huawei 192.168.8.1, then 192.168.1.1) with short timeouts
 * and adopt the first that speaks either protocol. This is what turns
 * "Login failed forever" into "just works" for a fresh install.
 */
async function detectClient(baseUrl: string): Promise<Detected> {
  if (!isNativePlatform()) return detectAt(baseUrl);

  const configured = effectiveBaseUrl(baseUrl);
  const candidates = [...new Set([configured, ...CANDIDATE_ROUTER_URLS])];
  let firstError: unknown = null;
  for (const url of candidates) {
    if (await GoformClient.probe(url, PROBE_TIMEOUT_MS)) {
      try {
        const zte = createClient(url);
        return { client: zte, device: await readDeviceInfo(zte), url };
      } catch (err) {
        firstError ??= err;
        continue;
      }
    }
    if (await HiLinkClient.probe(url, PROBE_TIMEOUT_MS)) {
      try {
        const hilink = new HiLinkClient({ baseUrl: url, onTraffic: devLogSink });
        return { client: hilink, device: await readDeviceInfo(hilink), url };
      } catch (err) {
        firstError ??= err;
      }
    }
  }
  if (firstError) throw firstError;
  throw new GoformError(
    `No router answered at ${candidates.join(', ')} — check that you are on the router's Wi-Fi`,
    { endpoint: 'discovery' },
  );
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
        // A connect may already be in flight (auto-connect + login racing) —
        // share it instead of running two discoveries over each other.
        if (connectInFlight) return connectInFlight;
        connectInFlight = (async () => {
          set({ status: 'connecting', error: null });
          try {
            const { client, device, url } = await detectClient(get().baseUrl);
            const router = resolveRouter(device);
            client.setAuthStrategy(router.authStrategy);
            // cr_version is only readable on an authenticated session.
            const loggedIn = !!(await client.getValue('cr_version'));
            set({ client, device, router, loggedIn, status: 'connected', error: null });
            // Native auto-discovery may have answered on a different address —
            // persist it so the next launch connects instantly.
            if (isNativePlatform() && url && url !== get().baseUrl) set({ baseUrl: url });
          } catch (err) {
            set({
              status: 'error',
              error: err instanceof Error ? err.message : 'Connection failed',
              client: null,
            });
          }
        })().finally(() => {
          connectInFlight = null;
        });
        return connectInFlight;
      },

      login: async (password) => {
        if (!get().client) await get().connect();
        const client = get().client;
        if (!client) {
          // The router itself is unreachable — surface that instead of the
          // misleading "Login failed" (the password was never even checked).
          return { ok: false, code: 'unreachable', message: get().error ?? undefined };
        }
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
