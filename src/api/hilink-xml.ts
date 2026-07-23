/**
 * Minimal XML codec for the Huawei HiLink API (5G CPE 5 / H155 family).
 *
 * HiLink responses are flat one-level XML documents:
 *
 *   <response><rsrp>-84dBm</rsrp><pci>123</pci></response>
 *   <error><code>108006</code><message/></error>
 *
 * A tiny regex parser keeps this dependency-free and working in both the
 * browser renderer and the node test environment (no DOMParser needed).
 */

export class HiLinkApiError extends Error {
  constructor(readonly code: string) {
    super(`HiLink API error ${code}`);
    this.name = 'HiLinkApiError';
  }
}

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
};

function decodeEntities(value: string): string {
  // The firmware also emits numeric character references — CSRF tokens contain
  // '/' and '+' which arrive as &#x2F; etc.; a partially-decoded token is
  // rejected by the router with error 125003.
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(?:lt|gt|quot|apos|amp);/g, (m) => ENTITIES[m] ?? m);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse a flat HiLink XML document into a string map of its leaf elements.
 * Throws HiLinkApiError when the firmware answered with an <error> document
 * (e.g. 100003 = no rights / login required, 108006 = wrong password).
 */
export function parseHiLinkXml(text: string): Record<string, string> {
  const t = text.trim();
  if (!t.startsWith('<')) throw new Error('HiLink response was not XML');

  const err = /<error>[\s\S]*?<code>\s*([^<\s]+)\s*<\/code>/i.exec(t);
  if (err) throw new HiLinkApiError(err[1]!);

  const out: Record<string, string> = {};
  // Leaf elements only: the text between the tags contains no markup.
  const leaf = /<([A-Za-z0-9_-]+)>([^<]*)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = leaf.exec(t)) !== null) {
    out[m[1]!] = decodeEntities(m[2]!.trim());
  }
  // Self-closing elements report as empty strings (<message/>).
  const empty = /<([A-Za-z0-9_-]+)\s*\/>/g;
  while ((m = empty.exec(t)) !== null) {
    if (!(m[1]! in out)) out[m[1]!] = '';
  }
  return out;
}

/** Build a HiLink POST body: <request><k>v</k>…</request>. */
export function buildHiLinkRequest(fields: Record<string, string | number>): string {
  const body = Object.entries(fields)
    .map(([k, v]) => `<${k}>${escapeXml(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><request>${body}</request>`;
}
