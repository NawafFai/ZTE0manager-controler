import type { ApiCommand, ApiConfidence, ApiDatabase } from '@/types';
import { buildSeedCommands } from './knowledge/seed';

/**
 * Merges commands from all sources (seed / discovered / observed) into one
 * queryable database, keyed by `method:id`. Higher-confidence metadata wins,
 * while provenance (`foundIn`) and parameters are unioned so a discovered
 * command still inherits documented params from the seed.
 */

const CONFIDENCE_RANK: Record<ApiConfidence, number> = {
  verified: 3,
  inferred: 2,
  experimental: 1,
};

function keyOf(cmd: ApiCommand): string {
  return `${cmd.method}:${cmd.id}`;
}

function mergePair(a: ApiCommand, b: ApiCommand): ApiCommand {
  // Base = the more trustworthy record.
  const [strong, weak] =
    CONFIDENCE_RANK[a.confidence] >= CONFIDENCE_RANK[b.confidence] ? [a, b] : [b, a];

  const foundIn = [...new Set([...(strong.foundIn ?? []), ...(weak.foundIn ?? [])])];
  const params = strong.params.length > 0 ? strong.params : weak.params;
  const sources = new Set([strong.source, weak.source]);

  return {
    ...strong,
    params,
    foundIn,
    // A command corroborated by discovery is more trustworthy than seed alone.
    confidence:
      sources.has('seed') && sources.has('discovered') && strong.confidence === 'inferred'
        ? 'verified'
        : strong.confidence,
    description: strong.description ?? weak.description,
    notes: strong.notes ?? weak.notes,
  };
}

export function mergeCommands(...groups: ApiCommand[][]): ApiCommand[] {
  const map = new Map<string, ApiCommand>();
  for (const group of groups) {
    for (const cmd of group) {
      const key = keyOf(cmd);
      const existing = map.get(key);
      map.set(key, existing ? mergePair(existing, cmd) : cmd);
    }
  }
  return [...map.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
  );
}

export function buildDatabase(
  discovered: ApiCommand[],
  observed: ApiCommand[] = [],
  firmware?: string,
): ApiDatabase {
  return {
    generatedAt: Date.now(),
    ...(firmware ? { firmware } : {}),
    commands: mergeCommands(buildSeedCommands(), discovered, observed),
  };
}

export function seedOnlyDatabase(firmware?: string): ApiDatabase {
  return buildDatabase([], [], firmware);
}

/** Group commands by category for the API Explorer UI. */
export function groupByCategory(db: ApiDatabase): Map<string, ApiCommand[]> {
  const groups = new Map<string, ApiCommand[]>();
  for (const cmd of db.commands) {
    const list = groups.get(cmd.category) ?? [];
    list.push(cmd);
    groups.set(cmd.category, list);
  }
  return groups;
}
