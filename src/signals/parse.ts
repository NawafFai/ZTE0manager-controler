/**
 * Defensive parsing helpers. Firmware fields are always strings and are often
 * empty, "--", or a placeholder when a value is unavailable. Every parse here
 * returns null on failure so the signal engine can mark a metric as missing
 * rather than rendering NaN.
 */

const PLACEHOLDERS = new Set(['', '--', 'N/A', 'n/a', 'null', 'unknown', '0x7fffffff']);

export function isPlaceholder(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  return PLACEHOLDERS.has(raw.trim());
}

export function toNumber(raw: string | null | undefined): number | null {
  if (isPlaceholder(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Parse a value that may be decimal or `0x`-prefixed hex. */
export function toIntFlexible(raw: string | null | undefined): number | null {
  if (isPlaceholder(raw)) return null;
  const s = (raw as string).trim();
  const n = s.toLowerCase().startsWith('0x') ? parseInt(s, 16) : parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function toBigIntHex(raw: string | null | undefined): bigint | null {
  if (isPlaceholder(raw)) return null;
  try {
    const s = (raw as string).trim();
    return s.toLowerCase().startsWith('0x') ? BigInt(s) : BigInt(s);
  } catch {
    return null;
  }
}

export function toStringOrNull(raw: string | null | undefined): string | null {
  return isPlaceholder(raw) ? null : (raw as string).trim();
}

/**
 * Firmware often reports several signal values joined by a separator (e.g.
 * per-carrier RSRP as "a;b;c"). We take the first valid numeric component.
 */
export function firstNumeric(raw: string | null | undefined, sep = /[;,|&]/): number | null {
  if (isPlaceholder(raw)) return null;
  for (const part of (raw as string).split(sep)) {
    const n = toNumber(part);
    if (n !== null) return n;
  }
  return null;
}
