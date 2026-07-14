import type { ApiCommand, ApiDatabase } from '@/types';

/**
 * Firmware diffing: compare two API databases so the tool can highlight what a
 * firmware update added, removed, or changed. This is what turns the app into a
 * longitudinal reverse-engineering record rather than a one-shot scanner.
 */

export interface ApiDiff {
  added: ApiCommand[];
  removed: ApiCommand[];
  changed: Array<{ before: ApiCommand; after: ApiCommand }>;
  unchanged: number;
}

function index(db: ApiDatabase): Map<string, ApiCommand> {
  return new Map(db.commands.map((c) => [`${c.method}:${c.id}`, c]));
}

function differs(a: ApiCommand, b: ApiCommand): boolean {
  return (
    a.category !== b.category ||
    a.confidence !== b.confidence ||
    a.params.length !== b.params.length ||
    a.params.some((p, i) => p.name !== b.params[i]?.name)
  );
}

export function diffDatabases(before: ApiDatabase, after: ApiDatabase): ApiDiff {
  const prev = index(before);
  const next = index(after);

  const added: ApiCommand[] = [];
  const removed: ApiCommand[] = [];
  const changed: Array<{ before: ApiCommand; after: ApiCommand }> = [];
  let unchanged = 0;

  for (const [key, cmd] of next) {
    const old = prev.get(key);
    if (!old) added.push(cmd);
    else if (differs(old, cmd)) changed.push({ before: old, after: cmd });
    else unchanged += 1;
  }
  for (const [key, cmd] of prev) {
    if (!next.has(key)) removed.push(cmd);
  }

  return { added, removed, changed, unchanged };
}
