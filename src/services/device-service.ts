import type { DeviceInfo, HostTelemetry, WanInfo, GoformSetResult } from '@/types';
import type { GoformClient } from '@/api/goform-client';
import { toNumber, toStringOrNull } from '@/signals/parse';

/**
 * Reads device identity + host telemetry. All fields are optional at the
 * firmware level, so every value degrades to null rather than throwing.
 */

const DEVICE_COMMANDS = [
  'modem_main_state',
  'model_name',
  'device_name',
  'wa_inner_version',
  'hardware_version',
  'imei',
  'imsi',
  'sim_iccid',
  'iccid',
  'msisdn',
  'cr_version',
];

// Temperature/uptime command names vary widely across ZTE builds; try several.
const TEMP_ALIASES = [
  'pm_modem_temp',
  'pm_sensor_mdm',
  'pm_sensor_pa1',
  'pm_modem_5g',
  'pm_modem_lte',
  'modem_temperature',
  'lte_pa_temp',
  'nr5g_pa_temp',
];
const UPTIME_ALIASES = ['sys_uptime', 'system_uptime', 'realtime_time'];
const TELEMETRY_COMMANDS = [...new Set([...UPTIME_ALIASES, ...TEMP_ALIASES])];

const WAN_COMMANDS = ['wan_ipaddr', 'ipv6_wan_ipaddr', 'ppp_status', 'realtime_time'];

function firstNum(r: Record<string, string>, keys: string[]): number | null {
  for (const k of keys) {
    const v = toNumber(r[k]);
    if (v !== null) return v;
  }
  return null;
}

export async function readDeviceInfo(client: GoformClient): Promise<DeviceInfo> {
  const r = await client.get({ cmd: DEVICE_COMMANDS });
  return {
    model: toStringOrNull(r.model_name) ?? toStringOrNull(r.device_name),
    firmware: toStringOrNull(r.wa_inner_version) ?? toStringOrNull(r.cr_version),
    hardwareVersion: toStringOrNull(r.hardware_version),
    waInnerVersion: toStringOrNull(r.wa_inner_version),
    imei: toStringOrNull(r.imei),
    imsi: toStringOrNull(r.imsi),
    iccid: toStringOrNull(r.sim_iccid) ?? toStringOrNull(r.iccid),
    msisdn: toStringOrNull(r.msisdn),
  };
}

export async function readTelemetry(client: GoformClient): Promise<HostTelemetry> {
  const r = await client.get({ cmd: TELEMETRY_COMMANDS });
  const temp = firstNum(r, TEMP_ALIASES);
  return {
    uptimeSeconds: firstNum(r, UPTIME_ALIASES),
    // ZTE temperature sensors often report milli-degrees; normalize > 200 down.
    temperatureC: temp !== null && temp > 200 ? Math.round(temp / 10) : temp,
    cpuPercent: null,
    ramPercent: null,
  };
}

export async function readWan(client: GoformClient): Promise<WanInfo> {
  const r = await client.get({ cmd: WAN_COMMANDS });
  return {
    ipv4: toStringOrNull(r.wan_ipaddr),
    ipv6: toStringOrNull(r.ipv6_wan_ipaddr),
    pppStatus: toStringOrNull(r.ppp_status),
    connectionUptimeSeconds: null,
  };
}

/**
 * Reboot the router. `REBOOT_DEVICE` is verified in service.js.
 */
export function rebootDevice(client: GoformClient) {
  return client.set({ goformId: 'REBOOT_DEVICE' });
}

/**
 * Network (RAT) preference via `SET_BEARER_PREFERENCE` (verified goformId,
 * param `BearerPreference`). `Only_LTE` (4G only) is confirmed working on the
 * reference device; note that "5G only" is impossible on NSA (5G needs an LTE
 * anchor) and is intentionally not offered. Useful when weak/congested 5G
 * (e.g. n40) is slower than solid 4G+CA.
 */
export type BearerPreference = string;

export function setBearerPreference(
  client: GoformClient,
  pref: BearerPreference,
  retry = true,
) {
  return client.set({
    goformId: 'SET_BEARER_PREFERENCE',
    params: { BearerPreference: pref },
    retry,
  });
}

/** Read the current network-mode string (for display / auto-restore). */
export async function readNetworkMode(client: GoformClient): Promise<string | null> {
  const r = await client.get({ cmd: ['current_network_mode', 'net_select_mode'] });
  return toStringOrNull(r.current_network_mode) ?? toStringOrNull(r.net_select_mode);
}

/**
 * "Auto" (all RATs, prefer 5G) has no single documented value across firmwares,
 * so we probe the known candidates once (each without retry, so it's fast) and
 * cache the first that the router accepts. Wrong candidates just return
 * `failure` and change nothing.
 */
// 5G-inclusive values first so "Auto" always keeps NR5G enabled (the user's SIM
// + router are 5G). Values that might prefer 3G/4G-only are intentionally omitted.
const AUTO_CANDIDATES = [
  'NR5G_preferred',
  'NR5G_LTE_WCDMA_GSM',
  'GSM_WCDMA_LTE_NR5G',
  'WCDMA_AND_LTE_AND_NR5G',
  'LTE_AND_NR5G',
  'NETWORK_auto',
  'AUTO',
];
let cachedAutoValue: string | null = null;

export async function setNetworkAuto(client: GoformClient): Promise<GoformSetResult> {
  if (cachedAutoValue) return setBearerPreference(client, cachedAutoValue);
  for (const value of AUTO_CANDIDATES) {
    const res = await setBearerPreference(client, value, false);
    if (!/fail/i.test(res.result ?? '')) {
      cachedAutoValue = value;
      return res;
    }
  }
  return { result: 'failure' };
}

/**
 * Cheap connectivity check used by Safe Mode's watchdog: the link is healthy
 * when PPP reports connected AND the modem has service. An unreachable router
 * (e.g. rebooting) counts as unhealthy.
 */
export async function isConnectionHealthy(client: GoformClient): Promise<boolean> {
  try {
    const r = await client.get({ cmd: ['ppp_status', 'network_type'] });
    const ppp = (r.ppp_status ?? '').toLowerCase();
    const nt = (r.network_type ?? '').toUpperCase();
    const connected = ppp.includes('connect');
    const hasService = nt !== '' && !nt.includes('NO_SERVICE') && !nt.includes('NO SERVICE');
    return connected && hasService;
  } catch {
    return false;
  }
}
