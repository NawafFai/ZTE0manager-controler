import type { ApiDatabase } from '@/types';

/**
 * Persistence for discovered API databases. Snapshots are keyed by firmware so
 * that swapping SIMs / updating firmware produces a new record we can diff
 * against, rather than clobbering prior knowledge. Storage is localStorage —
 * strictly on-device, no cloud (see SECURITY in README).
 */

const INDEX_KEY = 'zrm.re.index';
const SNAPSHOT_PREFIX = 'zrm.re.snapshot.';

interface SnapshotMeta {
  firmware: string;
  generatedAt: number;
  commandCount: number;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readIndex(): SnapshotMeta[] {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    return JSON.parse(ls.getItem(INDEX_KEY) ?? '[]') as SnapshotMeta[];
  } catch {
    return [];
  }
}

function writeIndex(index: SnapshotMeta[]): void {
  safeLocalStorage()?.setItem(INDEX_KEY, JSON.stringify(index));
}

export function saveSnapshot(db: ApiDatabase): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  const firmware = db.firmware ?? 'unknown';
  ls.setItem(`${SNAPSHOT_PREFIX}${firmware}`, JSON.stringify(db));

  const index = readIndex().filter((m) => m.firmware !== firmware);
  index.push({ firmware, generatedAt: db.generatedAt, commandCount: db.commands.length });
  writeIndex(index.sort((a, b) => b.generatedAt - a.generatedAt));
}

export function loadSnapshot(firmware: string): ApiDatabase | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  const raw = ls.getItem(`${SNAPSHOT_PREFIX}${firmware}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiDatabase;
  } catch {
    return null;
  }
}

export function listSnapshots(): SnapshotMeta[] {
  return readIndex();
}

export function latestSnapshot(): ApiDatabase | null {
  const first = readIndex()[0];
  return first ? loadSnapshot(first.firmware) : null;
}
