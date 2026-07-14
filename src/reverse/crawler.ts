import { KNOWN_JS_SEEDS } from './knowledge/seed';
import type { ParseInput } from './parser';

/**
 * Downloads the router's JavaScript so the parser can mine it. Starts from the
 * index page + known seed files, then follows `<script src>` and additional
 * `.js` paths referenced inside those files (one hop), deduplicating by URL.
 *
 * The fetcher is injected so this is unit-testable and so all traffic keeps
 * flowing through the app's same-origin proxy — nothing leaves localhost.
 */

export type Fetcher = (url: string) => Promise<{ ok: boolean; text: string }>;

export const browserFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { credentials: 'include' });
  return { ok: res.ok, text: await res.text() };
};

const SCRIPT_SRC = /<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;
const JS_REFERENCE = /["'](\/?[\w./-]+\.js)(?:\?[\w=&.]*)?["']/g;

function normalize(path: string, baseUrl: string): string | null {
  try {
    if (path.startsWith('http')) {
      // Only follow same-origin refs; never fetch third-party URLs.
      return null;
    }
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${clean}`;
  } catch {
    return null;
  }
}

export interface CrawlResult {
  files: ParseInput[];
  errors: string[];
}

export async function crawlJavaScript(
  baseUrl = '',
  fetcher: Fetcher = browserFetcher,
): Promise<CrawlResult> {
  const queue: string[] = [];
  const seen = new Set<string>();
  const files: ParseInput[] = [];
  const errors: string[] = [];

  const enqueue = (url: string | null) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      queue.push(url);
    }
  };

  // Seed: index page (to read <script src>) + known hidden-API files.
  enqueue(`${baseUrl}/`);
  enqueue(`${baseUrl}/index.html`);
  for (const seed of KNOWN_JS_SEEDS) enqueue(normalize(seed, baseUrl));

  const MAX_FILES = 60; // safety cap against runaway crawls
  while (queue.length > 0 && files.length < MAX_FILES) {
    const url = queue.shift()!;
    let result: { ok: boolean; text: string };
    try {
      result = await fetcher(url);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : 'fetch failed'}`);
      continue;
    }
    if (!result.ok) {
      errors.push(`${url}: not available`);
      continue;
    }

    const content = result.text;
    if (url.endsWith('.js')) {
      files.push({ file: url.replace(baseUrl, '') || url, content });
    }

    // Follow script tags (HTML) and .js references (both HTML and JS).
    for (const pattern of [SCRIPT_SRC, JS_REFERENCE]) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) {
        enqueue(normalize(m[1]!, baseUrl));
      }
    }
  }

  return { files, errors };
}
