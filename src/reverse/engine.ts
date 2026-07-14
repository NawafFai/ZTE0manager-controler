import type { ApiDatabase } from '@/types';
import { crawlJavaScript, type Fetcher } from './crawler';
import { parseJavaScript } from './parser';
import { buildDatabase } from './database';
import { diffDatabases, type ApiDiff } from './diff';
import { latestSnapshot, loadSnapshot, saveSnapshot } from './cache';

/**
 * Orchestrates a full discovery pass:
 *   crawl JS → parse commands → merge with seed knowledge → persist → diff.
 *
 * The result is a fresh database plus a diff against the previously stored
 * snapshot for the same firmware (or the most recent one), so a firmware change
 * surfaces its new/removed APIs automatically.
 */

export interface DiscoveryResult {
  database: ApiDatabase;
  diff: ApiDiff | null;
  crawledFiles: string[];
  errors: string[];
}

export interface DiscoveryOptions {
  baseUrl?: string;
  firmware?: string;
  fetcher?: Fetcher;
  /** Persist the resulting snapshot to localStorage (default true). */
  persist?: boolean;
}

export async function runDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const { baseUrl = '', firmware, fetcher, persist = true } = options;

  const crawl = await crawlJavaScript(baseUrl, fetcher);
  const discovered = parseJavaScript(crawl.files);
  const database = buildDatabase(discovered, [], firmware);

  const previous = (firmware && loadSnapshot(firmware)) || latestSnapshot();
  const diff = previous ? diffDatabases(previous, database) : null;

  if (persist) saveSnapshot(database);

  return {
    database,
    diff,
    crawledFiles: crawl.files.map((f) => f.file),
    errors: crawl.errors,
  };
}

export { diffDatabases };
