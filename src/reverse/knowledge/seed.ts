import type { ApiCommand, ApiCategory } from '@/types';

/**
 * Curated seed knowledge extracted from the project knowledge base
 * (KNOWN_DISCOVERIES.md / REVERSE_ENGINEERING_NOTES.md).
 *
 * This is the ONLY place we encode command names by hand, and only for
 * commands that were experimentally verified or observed in the router's
 * own JavaScript. Everything else is expected to be discovered at runtime by
 * the reverse-engineering engine. Keep this file synchronized with the .md
 * knowledge base — it is the machine-readable mirror of those documents.
 */

/** Verified GET commands with the category they belong to. */
const VERIFIED_GET: Array<[string, ApiCategory, string?]> = [
  ['network_type', 'network', 'Connection mode, e.g. ENDC / LTE / SA'],
  ['network_provider', 'network', 'Operator display name'],
  ['ppp_status', 'network', 'WAN/PPP state, e.g. ipv4_ipv6_connected'],
  ['rmcc', 'network', 'Registered mobile country code'],
  ['rmnc', 'network', 'Registered mobile network code'],
  ['signalbar', 'signal', 'Coarse signal bar 0-5'],
  ['cell_id', 'lte', 'Serving cell identity (hex)'],
  ['lte_pci', 'lte', 'LTE physical cell id'],
  ['lte_earfcn', 'lte', 'LTE E-UTRA ARFCN'],
  ['lte_band_lock', 'lte', 'Current LTE band-lock mask'],
  ['wan_lte_band', 'lte', 'Serving LTE band(s)'],
  ['wan_lte_ca', 'lte', 'LTE carrier-aggregation state (ca_activated)'],
  ['lte_ca_pcell_band', 'lte', 'LTE CA primary cell band'],
  ['lte_ca_pcell_bandwidth', 'lte', 'LTE PCC bandwidth (MHz)'],
  ['lte_ca_pcell_arfcn', 'lte', 'LTE PCC EARFCN'],
  ['lte_ca_scell_info', 'lte', 'LTE secondary cell (CA) info'],
  // Signal fields confirmed from the reference service.js status read.
  ['lte_rsrp', 'signal', 'LTE RSRP (dBm)'],
  ['lte_rsrq', 'signal', 'LTE RSRQ (dB)'],
  ['lte_snr', 'signal', 'LTE SINR (dB)'],
  ['rssi', 'signal', 'RSSI (dBm)'],
  ['nr5g_pci', 'nr5g', 'NR physical cell id'],
  ['nr5g_action_band', 'nr5g', 'Active NR band, e.g. n78'],
  ['nr5g_action_channel', 'nr5g', 'NR ARFCN'],
  ['nr5g_cell_id', 'nr5g', 'NR cell id'],
  ['Z5g_rsrp', 'signal', 'NR RSRP (dBm)'],
  ['Z5g_snr', 'signal', 'NR SNR (dB)'],
  ['Z5g_SINR', 'signal', 'NR SINR (dB)'],
  ['Z5g_dlEarfcn', 'nr5g', 'NR downlink ARFCN'],
  ['Z5g_CELL_ID', 'nr5g', 'NR cell id (Z5g)'],
  ['ZCELLINFO_band', 'nr5g', 'NR cell band info'],
  ['wan_nr5g_band', 'nr5g', 'Serving NR band(s)'],
  ['wan_nr5g_band_lock', 'nr5g', 'Current NR band-lock mask'],
  ['wa_inner_version', 'device', 'Inner firmware version (auth input)'],
  ['hardware_version', 'device', 'Hardware version (auth input)'],
  ['factory_mode', 'factory', 'Factory mode flag'],
  ['adb_enable', 'engineering', 'ADB enable flag'],
  ['loginfo', 'auth', 'Login / session state'],
];

/** Verified POST actions with parameters. */
const VERIFIED_POST: ApiCommand[] = [
  {
    id: 'LTE_LOCK_CELL_SET',
    method: 'POST',
    category: 'lte',
    confidence: 'verified',
    source: 'seed',
    mutating: true,
    description: 'Lock the LTE serving cell to a specific PCI + EARFCN.',
    foundIn: ['service.js'],
    params: [
      { name: 'lte_pci_lock', required: true, description: 'Target LTE PCI', example: '224' },
      {
        name: 'lte_earfcn_lock',
        required: true,
        description: 'Target LTE EARFCN',
        example: '1650',
      },
    ],
  },
  {
    id: 'WAN_PERFORM_NR5G_BAND_LOCK',
    method: 'POST',
    category: 'nr5g',
    confidence: 'verified',
    source: 'seed',
    mutating: true,
    description: 'Lock the NR (5G) radio to a set of bands (comma-separated band numbers).',
    foundIn: ['service.js', 'live nr5g_band_lock read'],
    params: [
      {
        name: 'nr5g_band_mask',
        required: true,
        description: 'Comma-separated NR band NUMBERS (not a hex bitmask)',
        example: '77,78',
      },
    ],
  },
  {
    id: 'BAND_SELECT',
    method: 'POST',
    category: 'lte',
    confidence: 'verified',
    source: 'seed',
    mutating: true,
    description: 'LTE (and 2G/3G) band selection / lock. Confirmed in service.js.',
    foundIn: ['service.js'],
    params: [
      { name: 'is_lte_band', required: true, description: '1 to apply LTE lock', example: '1' },
      { name: 'lte_band_mask', required: true, description: 'Hex LTE band mask', example: '0x5' },
      { name: 'is_gw_band', required: true, description: '1 to apply 2G/3G lock', example: '0' },
      { name: 'gw_band_mask', required: false, description: 'Hex 2G/3G band mask', example: '0x0' },
    ],
  },
  {
    id: 'REBOOT_DEVICE',
    method: 'POST',
    category: 'device',
    confidence: 'verified',
    source: 'seed',
    mutating: true,
    description: 'Reboot the router. Confirmed in service.js.',
    foundIn: ['service.js'],
    params: [],
  },
  {
    id: 'SIGNAL_QUALITY_DETECT_START',
    method: 'POST',
    category: 'diagnostics',
    confidence: 'verified',
    source: 'seed',
    mutating: true,
    description: 'Start the built-in signal-quality / cell detection scan. Confirmed in service.js.',
    foundIn: ['service.js'],
    params: [],
  },
];

/**
 * goformIds seen in service.js whose exact semantics/params still need
 * verification. Marked `inferred` so the UI can flag them as experimental and
 * never fire them destructively without an explicit user opt-in.
 */
const INFERRED_POST: Array<[string, ApiCategory, string]> = [
  ['SET_NETWORK', 'network', 'Set network selection mode'],
  ['SET_BEARER_PREFERENCE', 'network', 'Set RAT/bearer preference (LTE/NR/AUTO)'],
  ['SET_CONNECTION_MODE', 'network', 'Set connection mode'],
  ['SET_DEVICE_MTU', 'network', 'Set device MTU'],
  ['SET_WIFI_BAND', 'wifi', 'Set Wi-Fi band'],
  ['SET_WIFI_COVERAGE', 'wifi', 'Set Wi-Fi coverage/power'],
  ['WIFI_ADVANCE_SET', 'wifi', 'Advanced Wi-Fi settings'],
  ['SET_DEVICE_LED', 'device', 'Control status LED'],
  ['SET_THERMAL_CONTROL', 'thermal', 'Thermal control policy'],
  ['SET_NV', 'engineering', 'Write NV item (dangerous)'],
  ['APN_PROC', 'network', 'APN configuration'],
  ['APN_PROC_EX', 'network', 'Extended APN configuration'],
  ['VPN_CLIENT_SET', 'vpn', 'VPN client configuration'],
  ['VOIP_VOICE_WORK_TYPE_SET', 'voip', 'VoIP voice work type'],
  ['MGMT_CONTROL_POWER_ON_SPEED', 'diagnostics', 'Power-on speed management'],
  ['OPERATION_MODE', 'engineering', 'Operation mode'],
  ['UNLOCK_NETWORK', 'network', 'Clear network lock'],
  // Confirmed to exist in the reference service.js (params to verify).
  ['SHUTDOWN_DEVICE', 'device', 'Power off the router'],
  ['WAN_OPERATE_MODE_SET', 'network', 'Set WAN operate mode (operate_mode)'],
  ['BSP_ANTENNA_STATE_SET', 'engineering', 'Antenna state control (antenna_name, state)'],
  ['WAN_ANT_SWITCH_SET', 'engineering', 'Antenna switch (internal/external)'],
  ['RF_MMW_DISABLE_SET', 'nr5g', 'Enable/disable mmWave'],
  ['SEND_SMS', 'sms', 'Send an SMS'],
  ['DELETE_SMS', 'sms', 'Delete an SMS'],
  ['ENTER_PIN', 'sim', 'Enter SIM PIN'],
];

export function buildSeedCommands(): ApiCommand[] {
  const gets: ApiCommand[] = VERIFIED_GET.map(([id, category, description]) => ({
    id,
    method: 'GET',
    category,
    confidence: 'verified',
    source: 'seed',
    mutating: false,
    params: [],
    ...(description ? { description } : {}),
    foundIn: ['knowledge-base'],
  }));

  const inferred: ApiCommand[] = INFERRED_POST.map(([id, category, description]) => ({
    id,
    method: 'POST',
    category,
    confidence: 'inferred',
    source: 'seed',
    mutating: true,
    description,
    foundIn: ['service.js'],
    params: [],
  }));

  return [...gets, ...VERIFIED_POST, ...inferred];
}

/**
 * The router's two fixed transport endpoints. Everything else is a command
 * carried over one of these — there are no other hidden URLs to guess.
 */
export const GOFORM_GET_ENDPOINT = '/goform/goform_get_cmd_process';
export const GOFORM_SET_ENDPOINT = '/goform/goform_set_cmd_process';

/** Static JS files known to carry the hidden API surface, used as crawl seeds. */
export const KNOWN_JS_SEEDS = [
  '/js/service.js',
  '/js/main.js',
  '/js/app.js',
  '/js/config/config.js',
];
