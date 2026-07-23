/**
 * Pure translation layer: Huawei HiLink endpoint responses → the ZTE goform
 * command keys the rest of the app already understands (signal engine aliases,
 * device-service fields). Keeping it pure makes the mapping unit-testable
 * without any HTTP.
 */

import {
  huaweiLteBandToZte,
  huaweiNrBandToList,
  neighborBlobs,
  networkModeLabel,
  parseNetMode,
} from './hilink-net';

export interface HiLinkState {
  /** /api/device/basic_information — readable without login. */
  basic: Record<string, string> | null;
  /** /api/user/state-login — State "0" means authenticated. */
  loginState: Record<string, string> | null;
  /** /api/monitoring/status */
  status: Record<string, string> | null;
  /** /api/monitoring/traffic-statistics */
  traffic: Record<string, string> | null;
  /** /api/device/information — requires login. */
  info: Record<string, string> | null;
  /** /api/device/signal — requires login. */
  signal: Record<string, string> | null;
  /** /api/net/current-plmn — requires login. */
  plmn: Record<string, string> | null;
  /** /api/net/net-mode — current RAT + band masks (requires login). */
  netMode?: Record<string, string> | null;
  /** /api/device/nbrcellinfo — neighbour cells (requires login). */
  nbr?: Record<string, string> | null;
  /** /api/device/seccellinfo — secondary (CA) cells (requires login). */
  sec?: Record<string, string> | null;
}

/** Case-insensitive field lookup (HiLink mixes PascalCase and lowercase). */
function pick(rec: Record<string, string> | null, ...names: string[]): string | null {
  if (!rec) return null;
  for (const name of names) {
    if (rec[name] !== undefined && rec[name] !== '') return rec[name]!;
  }
  const lower = new Map(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const v = lower.get(name.toLowerCase());
    if (v !== undefined && v !== '') return v;
  }
  return null;
}

/**
 * HiLink reports signal values with units ("-84dBm", "20MHz"); the app's
 * parsers expect bare numbers. Extract the first numeric token.
 */
function numToken(value: string | null): string | null {
  if (value === null) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(value);
  return m ? m[0] : null;
}

function setIf(out: Record<string, string>, key: string, value: string | null): void {
  if (value !== null && value !== '') out[key] = value;
}

/**
 * Connection-mode string fed into the signal engine's parseMode().
 *
 * The strongest 5G signal on this firmware is `EndcStatus` in monitoring/status:
 * EndcStatus=1 means E-UTRAN/NR Dual Connectivity is active, i.e. the device is
 * on 5G NSA (LTE anchor + NR). `CurrentNetworkTypeEx` 10x codes also indicate a
 * 5G-capable attach. Detailed SA/NSA disambiguation from device/signal is not
 * available here (carrier-locked), so we report ENDC for active dual connectivity.
 */
function modeString(s: HiLinkState): string | null {
  if (pick(s.status, 'EndcStatus') === '1') return 'ENDC';
  const wm = pick(s.info, 'workmode', 'WorkMode');
  if (wm) return wm.toUpperCase() === 'SA' ? 'NR_SA' : wm;
  const t = pick(s.status, 'CurrentNetworkType');
  const ex = pick(s.status, 'CurrentNetworkTypeEx');
  if (t === '0' || ex === '0') return 'NO_SERVICE';
  if (ex && /^10\d/.test(ex)) return 'NR_NSA'; // 101/102… 5G-capable attach
  if (t) return 'LTE';
  return null;
}

export function isHiLinkLoggedIn(loginState: Record<string, string> | null): boolean {
  return pick(loginState, 'State') === '0';
}

/** Translate a fetched HiLink state into a ZTE-style command→value map. */
export function hiLinkToCommands(s: HiLinkState): Record<string, string> {
  const out: Record<string, string> = {};
  const logged = isHiLinkLoggedIn(s.loginState);

  // --- identity (device-service DEVICE_COMMANDS) ---
  setIf(out, 'model_name', pick(s.basic, 'spreadname_en') ?? pick(s.basic, 'devicename'));
  setIf(out, 'device_name', pick(s.basic, 'devicename'));
  setIf(out, 'hardware_version', pick(s.basic, 'devicename') ?? pick(s.info, 'HardwareVersion'));
  setIf(out, 'wa_inner_version', pick(s.info, 'SoftwareVersion'));
  // cr_version doubles as the app's "session is authenticated" probe.
  if (logged) out.cr_version = pick(s.info, 'WebUIVersion') ?? 'HiLink';
  setIf(out, 'imei', pick(s.info, 'Imei'));
  setIf(out, 'imsi', pick(s.info, 'Imsi'));
  setIf(out, 'sim_iccid', pick(s.info, 'Iccid'));
  setIf(out, 'msisdn', pick(s.info, 'Msisdn'));

  // --- WAN / connection ---
  const conn = pick(s.status, 'ConnectionStatus');
  if (conn) out.ppp_status = conn === '901' ? 'ppp_connected' : 'ppp_disconnected';
  setIf(out, 'wan_ipaddr', pick(s.status, 'WanIPAddress') ?? pick(s.info, 'WanIPAddress'));
  setIf(out, 'ipv6_wan_ipaddr', pick(s.status, 'WanIPv6Address'));
  setIf(out, 'realtime_time', numToken(pick(s.traffic, 'CurrentConnectTime')));
  setIf(out, 'signalbar', pick(s.status, 'SignalIcon') ?? pick(s.status, 'SignalStrength'));
  // Carrier aggregation / 5G dual-connectivity: EndcStatus=1 ⇒ NR aggregated
  // with the LTE anchor. This is the only CA signal this firmware exposes
  // (seccellinfo is carrier-locked), so drive the app's CA badge from it.
  if (pick(s.status, 'EndcStatus') === '1') out.wan_lte_ca = '1';

  // --- operator ---
  setIf(out, 'network_provider', pick(s.plmn, 'FullName') ?? pick(s.plmn, 'ShortName'));
  const numeric = pick(s.plmn, 'Numeric');
  if (numeric && numeric.length >= 5) {
    out.rmcc = numeric.slice(0, 3);
    out.rmnc = numeric.slice(3);
  }
  setIf(out, 'network_type', modeString(s));

  // --- LTE serving cell (/api/device/signal, lowercase fields) ---
  setIf(out, 'lte_rsrp', numToken(pick(s.signal, 'rsrp')));
  setIf(out, 'lte_rsrq', numToken(pick(s.signal, 'rsrq')));
  setIf(out, 'lte_snr', numToken(pick(s.signal, 'sinr')));
  setIf(out, 'rssi', numToken(pick(s.signal, 'rssi')));
  setIf(out, 'lte_cqi', numToken(pick(s.signal, 'cqi', 'cqi0')));
  setIf(out, 'lte_pci', numToken(pick(s.signal, 'pci')));
  setIf(out, 'cell_id', numToken(pick(s.signal, 'cell_id', 'cellid')));
  setIf(out, 'lte_earfcn', numToken(pick(s.signal, 'earfcn')));
  setIf(out, 'lte_band', pick(s.signal, 'band'));
  setIf(out, 'lte_bandwidth', numToken(pick(s.signal, 'dlbandwidth')));
  setIf(out, 'tac', numToken(pick(s.signal, 'tac')));

  // --- NR serving cell ---
  setIf(out, 'Z5g_rsrp', numToken(pick(s.signal, 'nrrsrp', 'nr_rsrp')));
  setIf(out, 'Z5g_rsrq', numToken(pick(s.signal, 'nrrsrq', 'nr_rsrq')));
  setIf(out, 'Z5g_SINR', numToken(pick(s.signal, 'nrsinr', 'nr_sinr')));
  setIf(out, 'nr5g_pci', numToken(pick(s.signal, 'nrpci', 'nr_pci')));
  setIf(out, 'nr5g_cell_id', numToken(pick(s.signal, 'nrcellid', 'nr_cell_id')));
  setIf(out, 'nr5g_action_band', pick(s.signal, 'nrband', 'nr_band'));
  setIf(out, 'nr5g_action_channel', numToken(pick(s.signal, 'nrearfcn', 'nr_earfcn', 'nrarfcn')));
  setIf(out, 'nr5g_bandwidth', numToken(pick(s.signal, 'nrdlbandwidth')));

  // --- band-lock status + RAT preference (from /api/net/net-mode) ---
  if (s.netMode) {
    const nm = parseNetMode(s.netMode);
    out.lte_band_lock = huaweiLteBandToZte(nm.lteBand);
    if (nm.nrBand) out.wan_nr5g_band_lock = huaweiNrBandToList(nm.nrBand);
    out.current_network_mode = networkModeLabel(nm.networkMode);
  }

  // --- neighbour / secondary (CA) cells → tower-service blobs ---
  if (s.nbr || s.sec) {
    const blobs = neighborBlobs(s.nbr ?? null, s.sec ?? null);
    setIf(out, 'lte_neighbor_cell', blobs.lte);
    setIf(out, 'nr5g_neighbor_cell', blobs.nr);
    // CA is active when the modem reports any secondary serving cell.
    if (s.sec && Object.keys(s.sec).length > 0) out.wan_lte_ca = '1';
  }

  return out;
}
