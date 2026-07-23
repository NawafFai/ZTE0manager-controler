import type { RouterPlugin } from './types';
import { NO_CAPABILITIES } from './types';

/**
 * Huawei 5G CPE 5 (H155-383, sold as "5G CPE 5", default host 192.168.8.1).
 *
 * Not a ZTE device: it speaks the HiLink XML API, adapted by HiLinkClient.
 * Matching works on both identity strings the adapter reports —
 * model "5G CPE 5" (spreadname) and hardware "H155-383" (devicename).
 *
 * What this specific firmware exposes (verified live, 2026-07-16):
 *   - connection status, network type (5G-NSA/ENDC), signal bars, operator,
 *     data usage + live rates, uptime, WiFi client count, full device identity,
 *     reboot — all working;
 *   - carrier-aggregation *badge* from EndcStatus (NR aggregated with LTE).
 *
 * Carrier-locked on this STC unit (return HTTP 100003 "no rights" even as the
 * admin user, so they are OFF): detailed dBm signal (/api/device/signal), band
 * lock (/api/net/net-mode), cell lock, and neighbour/tower scan
 * (/api/device/nbrcellinfo). The band-lock/net-mode code paths remain in
 * HiLinkClient for non-locked Huawei units and real ZTE devices; here they
 * degrade gracefully (the endpoints simply refuse).
 */
export const huaweiH155Plugin: RouterPlugin = {
  id: 'huawei-h155',
  name: 'Huawei 5G CPE 5 (H155)',
  models: ['H155', '5G CPE'],
  capabilities: () => ({
    ...NO_CAPABILITIES,
    // Only CA is observable; band/cell lock + tower scan are carrier-locked.
    carrierAggregation: true,
  }),
};
