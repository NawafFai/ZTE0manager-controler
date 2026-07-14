import type {
  CarrierComponent,
  ConnectionMode,
  GoformGetResult,
  LteMetrics,
  NrMetrics,
  RadioSnapshot,
} from '@/types';
import { metric } from './quality';
import { firstNumeric, isPlaceholder, toIntFlexible, toStringOrNull } from './parse';

/**
 * Alias-based field resolution.
 *
 * ZTE firmwares disagree on the exact command name for the same metric
 * (`lte_snr` vs `lte_sinr`, `nr5g_rsrp` vs `Z5g_rsrp`, …). Rather than betting
 * on one name, we request the union of all known aliases in a single read and,
 * per metric, take the first alias that returned a real value. This is what
 * lets the live monitor / tower pages show real numbers across models without
 * per-firmware code — unknown aliases simply come back empty.
 */
// Aliases are ordered best-first. The leading names are the ones CONFIRMED in
// the reference MC801A1 service.js (see KNOWN_DISCOVERIES.md); the rest are
// fallbacks for other firmwares/models.
const ALIASES = {
  mode: ['network_type', 'wan_active_band_type'],
  operator: ['network_provider', 'net_select_name'],
  mcc: ['rmcc', 'mcc'],
  mnc: ['rmnc', 'mnc'],
  signalbar: ['signalbar'],
  caState: ['wan_lte_ca', 'lte_ca_state'],

  lteRsrp: ['lte_rsrp', 'rsrp', 'wan_lte_rsrp'],
  lteRsrq: ['lte_rsrq', 'rsrq'],
  lteSinr: ['lte_snr', 'lte_sinr', 'sinr', 'snr'],
  lteRssi: ['rssi', 'lte_rssi'],
  lteCqi: ['lte_cqi', 'cqi'],
  lteBand: ['lte_ca_pcell_band', 'wan_lte_band', 'lte_band'],
  lteBw: ['lte_ca_pcell_bandwidth', 'lte_pcc_bandwidth', 'lte_bandwidth'],
  lteEarfcn: ['lte_ca_pcell_arfcn', 'lte_earfcn', 'wan_lte_earfcn'],
  ltePci: ['lte_pci'],
  lteCellId: ['cell_id', 'lte_cell_id'],
  lteTac: ['tac', 'lte_tac'],

  nrRsrp: ['Z5g_rsrp', 'nr5g_rsrp', 'nr_rsrp'],
  nrRsrq: ['Z5g_rsrq', 'nr5g_rsrq', 'nr_rsrq'],
  nrSinr: ['Z5g_SINR', 'Z5g_snr', 'nr5g_snr', 'nr5g_sinr', 'nr_sinr'],
  nrBand: ['nr5g_action_band', 'ZCELLINFO_band', 'wan_nr5g_band'],
  nrArfcn: ['Z5g_dlEarfcn', 'nr5g_action_channel', 'nr_arfcn'],
  nrPci: ['nr5g_pci', 'Z5g_pci'],
  nrCellId: ['Z5g_CELL_ID', 'nr5g_cell_id', 'nr_cell_id'],
  nrBw: ['nr5g_bandwidth', 'Z5g_bandwidth'],
} as const;

/** Every command the signal engine reads (union of all aliases), deduplicated. */
export const SIGNAL_COMMANDS: readonly string[] = [
  ...new Set(Object.values(ALIASES).flat()),
];

type AliasKey = keyof typeof ALIASES;

function pickNum(raw: GoformGetResult, key: AliasKey): number | null {
  for (const name of ALIASES[key]) {
    const v = firstNumeric(raw[name]);
    if (v !== null) return v;
  }
  return null;
}

function pickInt(raw: GoformGetResult, key: AliasKey): number | null {
  for (const name of ALIASES[key]) {
    const v = toIntFlexible(raw[name]);
    if (v !== null) return v;
  }
  return null;
}

function pickStr(raw: GoformGetResult, key: AliasKey): string | null {
  for (const name of ALIASES[key]) {
    const v = toStringOrNull(raw[name]);
    if (v !== null) return v;
  }
  return null;
}

function parseMode(raw: string | null): ConnectionMode {
  if (!raw) return 'UNKNOWN';
  const v = raw.toUpperCase();
  if (v.includes('ENDC')) return 'ENDC';
  if (v.includes('NSA')) return 'NR_NSA';
  if (v.includes('SA') && v.includes('NR')) return 'NR_SA';
  if (v === 'NR5G' || v === 'NR') return 'NR_SA';
  if (v.includes('LTE') || v.includes('4G')) return 'LTE';
  if (v.includes('NO_SERVICE') || v.includes('NO SERVICE')) return 'NO_SERVICE';
  return 'UNKNOWN';
}

/** eNodeB id from a 28-bit LTE ECI (cell id = eNB*256 + sector). */
function deriveEnb(cellId: number | null): number | null {
  return cellId === null ? null : Math.floor(cellId / 256);
}

/** gNodeB id from a 36-bit NR NCI (assuming 12-bit cell id per 3GPP default). */
function deriveGnb(cellId: number | null): number | null {
  return cellId === null ? null : Math.floor(cellId / 4096);
}

function buildLte(raw: GoformGetResult): LteMetrics {
  const cellIdInt = pickInt(raw, 'lteCellId');
  return {
    rsrp: metric('rsrp', pickNum(raw, 'lteRsrp')),
    rsrq: metric('rsrq', pickNum(raw, 'lteRsrq')),
    sinr: metric('sinr', pickNum(raw, 'lteSinr')),
    rssi: metric('rssi', pickNum(raw, 'lteRssi')),
    cqi: metric('cqi', pickNum(raw, 'lteCqi')),
    band: pickStr(raw, 'lteBand'),
    bandwidthMhz: pickNum(raw, 'lteBw'),
    earfcn: pickInt(raw, 'lteEarfcn'),
    pci: pickInt(raw, 'ltePci'),
    cellId: pickStr(raw, 'lteCellId'),
    enbId: deriveEnb(cellIdInt),
    tac: pickStr(raw, 'lteTac'),
  };
}

function buildNr(raw: GoformGetResult): NrMetrics {
  const cellIdInt = pickInt(raw, 'nrCellId');
  return {
    rsrp: metric('rsrp', pickNum(raw, 'nrRsrp')),
    rsrq: metric('rsrq', pickNum(raw, 'nrRsrq')),
    sinr: metric('sinr', pickNum(raw, 'nrSinr')),
    band: pickStr(raw, 'nrBand'),
    bandwidthMhz: pickNum(raw, 'nrBw'),
    arfcn: pickInt(raw, 'nrArfcn'),
    pci: pickInt(raw, 'nrPci'),
    cellId: pickStr(raw, 'nrCellId'),
    gnbId: deriveGnb(cellIdInt),
  };
}

/**
 * Carrier-aggregation components. The primary carriers are the serving LTE + NR
 * cells; secondary cells are appended when the firmware exposes them.
 */
function buildCarriers(lte: LteMetrics, nr: NrMetrics): CarrierComponent[] {
  const carriers: CarrierComponent[] = [];
  if (lte.pci !== null || lte.band) {
    carriers.push({
      type: 'LTE',
      role: 'PCC',
      band: lte.band,
      earfcnArfcn: lte.earfcn,
      bandwidthMhz: lte.bandwidthMhz,
      pci: lte.pci,
    });
  }
  if (nr.pci !== null || nr.band) {
    carriers.push({
      type: 'NR',
      role: 'PCC',
      band: nr.band,
      earfcnArfcn: nr.arfcn,
      bandwidthMhz: nr.bandwidthMhz,
      pci: nr.pci,
    });
  }
  return carriers;
}

/** Pure transform: raw firmware map → normalized, classified snapshot. */
export function buildSnapshot(raw: GoformGetResult, timestamp = Date.now()): RadioSnapshot {
  const lte = buildLte(raw);
  const nr = buildNr(raw);
  const caRaw = pickStr(raw, 'caState');
  return {
    timestamp,
    mode: parseMode(pickStr(raw, 'mode')),
    operator: pickStr(raw, 'operator'),
    mcc: pickStr(raw, 'mcc'),
    mnc: pickStr(raw, 'mnc'),
    signalBars: pickNum(raw, 'signalbar'),
    lte,
    nr,
    carriers: buildCarriers(lte, nr),
    caActive: !isPlaceholder(caRaw) && /activ|on|1|true/i.test(caRaw ?? ''),
  };
}
