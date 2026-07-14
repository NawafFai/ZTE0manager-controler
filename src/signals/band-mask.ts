/**
 * Band-lock mask math.
 *
 * ZTE encodes allowed bands as a bit mask where bit (N-1) selects band N.
 * For LTE, band N (B3 → bit 2). For NR, band nN (n78 → bit 77). Masks are wide
 * (NR reaches bit 100+), so we use BigInt end-to-end. This mirrors the observed
 * value `lte_band_lock = 0x180080800c5` from the knowledge base.
 */

export function bandsFromMask(mask: bigint): number[] {
  const bands: number[] = [];
  let bit = 0n;
  let remaining = mask;
  while (remaining > 0n) {
    if (remaining & 1n) bands.push(Number(bit) + 1);
    remaining >>= 1n;
    bit += 1n;
  }
  return bands;
}

export function maskFromBands(bands: number[]): bigint {
  return bands.reduce((mask, band) => {
    if (band < 1) return mask;
    return mask | (1n << BigInt(band - 1));
  }, 0n);
}

export function maskToHex(mask: bigint): string {
  return `0x${mask.toString(16)}`;
}

export function parseMask(raw: string): bigint {
  const s = raw.trim();
  return s.toLowerCase().startsWith('0x') ? BigInt(s) : BigInt(s);
}

/** Human labels: LTE bands render as "B3", NR bands as "n78". */
export function formatLteBand(band: number): string {
  return `B${band}`;
}

export function formatNrBand(band: number): string {
  return `n${band}`;
}

/** Extract the numeric band from a string like "B3", "n78", "3", "78". */
export function bandNumber(label: string): number | null {
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * NR presets. The multi-band combos let the modem run NR carrier aggregation
 * (e.g. n41 + n78), which measurably raises throughput vs a single band — while
 * excluding slow low bands like n40.
 */
export const NR_PRESETS: Record<string, number[]> = {
  'n41 + n78 (CA)': [41, 78],
  'n41 + n77 + n78': [41, 77, 78],
  'All fast (no n40)': [1, 3, 41, 77, 78],
  'n78 only': [78],
  'n41 only': [41],
  'n77 + n78': [77, 78],
  'n28 (low-band)': [28],
};

export function nrPresetMask(name: keyof typeof NR_PRESETS): bigint {
  return maskFromBands(NR_PRESETS[name] ?? []);
}
