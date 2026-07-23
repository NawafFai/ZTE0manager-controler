/**
 * Pure mappings between the app's ZTE goform band/lock/scan vocabulary and the
 * Huawei HiLink `/api/net/net-mode` + neighbour-cell contract.
 *
 * The net-mode contract is the same across the HiLink line (E5/B5/H1xx):
 *   GET  /api/net/net-mode → <NetworkMode><NetworkBand><LTEBand><NRBand>
 *   POST /api/net/net-mode ← same four fields (ALL required together)
 * where LTEBand / NRBand are hex bitmasks with bit (N-1) set for band N — the
 * exact convention band-mask.ts already uses, so LTE masks pass straight
 * through. NR is stored by the app as a comma list, so it's (de)serialised here.
 *
 * Everything is a pure function → unit-testable with no HTTP. The client layer
 * does read-modify-write (GET current mode, change ONE field, POST) so a band
 * lock can never accidentally flip the RAT (NetworkMode) or the 2G/3G band.
 */

/** Huawei NetworkMode selectors we use (5G-only is impossible on NSA, omitted). */
export const NET_MODE_AUTO = '00'; // all RATs incl. NR5G
export const NET_MODE_LTE_ONLY = '03';

/** All-ones masks = "let the modem choose" (unlock). */
export const LTE_BAND_ALL = '7FFFFFFFFFFFFFFF';
export const NETWORK_BAND_ALL = '3FFFFFFF';

/** Full NR set for this modem class (used as the NR "unlock"/allow-all mask). */
export const NR_ALL_BANDS = [1, 3, 5, 7, 8, 20, 28, 38, 40, 41, 66, 71, 77, 78, 79];

export interface NetMode {
  networkMode: string;
  networkBand: string;
  lteBand: string;
  nrBand: string;
}

function up(hex: string): string {
  return hex.replace(/^0x/i, '').toUpperCase() || '0';
}

/** Parse a /api/net/net-mode response (case-insensitive, tolerant of gaps). */
export function parseNetMode(r: Record<string, string> | null): NetMode {
  const get = (k: string) => {
    if (!r) return '';
    if (r[k] !== undefined) return r[k]!;
    const lower = k.toLowerCase();
    for (const [key, val] of Object.entries(r)) if (key.toLowerCase() === lower) return val;
    return '';
  };
  return {
    networkMode: get('NetworkMode') || NET_MODE_AUTO,
    networkBand: get('NetworkBand') || NETWORK_BAND_ALL,
    lteBand: up(get('LTEBand') || LTE_BAND_ALL),
    nrBand: up(get('NRBand')),
  };
}

/** Build the four-field POST body for /api/net/net-mode. */
export function netModeRequest(m: NetMode): Record<string, string> {
  const body: Record<string, string> = {
    NetworkMode: m.networkMode,
    NetworkBand: up(m.networkBand),
    LTEBand: up(m.lteBand),
  };
  // Only send NRBand when the device exposes one (5G models) — sending it to a
  // 4G-only firmware can be rejected.
  if (m.nrBand && m.nrBand !== '0') body.NRBand = up(m.nrBand);
  return body;
}

// --- band mask conversions (bit N-1 ⇄ band number) --------------------------

/** LTE: the app's hex mask already matches Huawei's LTEBand — normalise only. */
export function lteMaskToHuawei(hexMask: string): string {
  return up(hexMask);
}

/** Huawei LTEBand hex → the app's `0x…` form for `lte_band_lock`. */
export function huaweiLteBandToZte(lteBandHex: string): string {
  return `0x${(lteBandHex || '0').replace(/^0x/i, '').toLowerCase()}`;
}

/** NR comma list ("77,78" / "n78, n41") → Huawei NRBand hex bitmask. */
export function nrListToHuaweiMask(list: string): string {
  const nums = list.match(/\d+/g) ?? [];
  let mask = 0n;
  for (const n of nums) {
    const band = parseInt(n, 10);
    if (band >= 1) mask |= 1n << BigInt(band - 1);
  }
  return mask.toString(16).toUpperCase() || '0';
}

/** Huawei NRBand hex bitmask → the app's comma list "77,78". */
export function huaweiNrBandToList(nrBandHex: string): string {
  let mask: bigint;
  try {
    mask = BigInt(`0x${(nrBandHex || '0').replace(/^0x/i, '')}`);
  } catch {
    return '';
  }
  const bands: number[] = [];
  let bit = 0n;
  while (mask > 0n) {
    if (mask & 1n) bands.push(Number(bit) + 1);
    mask >>= 1n;
    bit += 1n;
  }
  return bands.join(',');
}

/** All-NR mask used for "unlock NR". */
export function nrAllMask(): string {
  return nrListToHuaweiMask(NR_ALL_BANDS.join(','));
}

/** Readable RAT string for `current_network_mode` display. */
export function networkModeLabel(mode: string): string {
  switch ((mode || '').toUpperCase()) {
    case '00':
      return 'AUTO';
    case '01':
      return 'GSM';
    case '02':
      return 'WCDMA';
    case '03':
      return 'LTE';
    default:
      return mode || 'AUTO';
  }
}

// --- neighbour / secondary cells → ZTE-style ";"-blob ------------------------

interface CellRow {
  pci?: string;
  arfcn?: string;
  band?: string;
  rsrp?: string;
  rsrq?: string;
  sinr?: string;
}

function num(v: string | undefined): string {
  if (v === undefined) return '';
  const m = /-?\d+(?:\.\d+)?/.exec(v);
  return m ? m[0] : '';
}

function rowToBlob(rows: CellRow[]): string {
  return rows
    .map((c) =>
      [num(c.pci), num(c.arfcn), c.band ?? '', num(c.rsrp), num(c.rsrq), num(c.sinr)].join(','),
    )
    .filter((s) => /\d/.test(s))
    .join(';');
}

/**
 * Convert HiLink neighbour/secondary-cell responses into the ";"-separated
 * "pci,arfcn,band,rsrp,rsrq,sinr" blobs the tower-service parses. The nbrcell
 * schema varies per firmware, so we tolerantly gather cells from either a list
 * of numbered fields (Pci0/Rsrp0…) or a flat single-cell record; unknown shapes
 * yield an empty blob (serving cells are still shown by the caller).
 */
export function neighborBlobs(
  nbr: Record<string, string> | null,
  sec: Record<string, string> | null,
): { lte: string; nr: string } {
  const lte: CellRow[] = [];
  const nr: CellRow[] = [];

  const collectIndexed = (rec: Record<string, string> | null, sink: CellRow[]) => {
    if (!rec) return;
    // Numbered fields: Pci0, Earfcn0, Rsrp0 … up to a small bound.
    for (let i = 0; i < 12; i += 1) {
      const g = (name: string) => rec[`${name}${i}`] ?? rec[`${name}_${i}`];
      const pci = g('Pci') ?? g('pci');
      const rsrp = g('Rsrp') ?? g('rsrp');
      if (pci === undefined && rsrp === undefined) continue;
      sink.push({
        pci,
        arfcn: g('Earfcn') ?? g('earfcn') ?? g('Arfcn') ?? g('arfcn'),
        band: g('Band') ?? g('band'),
        rsrp,
        rsrq: g('Rsrq') ?? g('rsrq'),
        sinr: g('Sinr') ?? g('sinr') ?? g('Snr') ?? g('snr'),
      });
    }
    // Flat single-cell fallback.
    if (sink.length === 0 && (rec.Pci !== undefined || rec.pci !== undefined)) {
      sink.push({
        pci: rec.Pci ?? rec.pci,
        arfcn: rec.Earfcn ?? rec.earfcn ?? rec.Arfcn ?? rec.arfcn,
        band: rec.Band ?? rec.band,
        rsrp: rec.Rsrp ?? rec.rsrp,
        rsrq: rec.Rsrq ?? rec.rsrq,
        sinr: rec.Sinr ?? rec.sinr,
      });
    }
  };

  collectIndexed(nbr, lte);
  collectIndexed(sec, lte); // secondary (CA) cells listed alongside LTE neighbours
  return { lte: rowToBlob(lte), nr: rowToBlob(nr) };
}
