import { describe, expect, it } from 'vitest';
import { FEATURE_MAP, resolveUnlockableFeatures, type UnlockFeatureId } from './feature-unlock';
import { buildDatabase } from '@/reverse/database';
import { parseJavaScript } from '@/reverse/parser';
import type { ApiCommand, ApiDatabase } from '@/types';

/**
 * Per-model command resolution: given a database with/without each goformId,
 * the resolver must report available/unavailable correctly — this is what
 * guarantees "controls appear only for commands present in the discovered DB".
 */

function post(id: string, extra: Partial<ApiCommand> = {}): ApiCommand {
  return {
    id,
    method: 'POST',
    category: 'experimental',
    confidence: 'experimental',
    source: 'discovered',
    mutating: true,
    params: [],
    foundIn: ['service.js'],
    ...extra,
  };
}

function dbOf(...commands: ApiCommand[]): ApiDatabase {
  return { generatedAt: 0, commands };
}

function resolved(db: ApiDatabase, feature: UnlockFeatureId) {
  const entry = resolveUnlockableFeatures(db).find((f) => f.feature === feature);
  expect(entry).toBeDefined();
  return entry!;
}

describe('resolveUnlockableFeatures', () => {
  it('reports every feature unavailable on an empty database', () => {
    const result = resolveUnlockableFeatures(dbOf());
    expect(result).toHaveLength(FEATURE_MAP.length);
    for (const f of result) {
      expect(f.available).toBe(false);
      expect(f.goformId).toBeNull();
      expect(f.confidence).toBeNull();
      expect(f.driveable).toBe(false);
      expect(f.candidates.length).toBeGreaterThan(0);
    }
  });

  it.each(FEATURE_MAP.map((s) => [s.feature, s.candidates[0]!.goformId] as const))(
    'resolves %s when %s is present — and ONLY that feature',
    (feature, goformId) => {
      const db = dbOf(post(goformId));
      const hit = resolved(db, feature);
      expect(hit.available).toBe(true);
      expect(hit.goformId).toBe(goformId);
      // No other feature may light up from this command.
      for (const other of resolveUnlockableFeatures(db)) {
        if (other.feature !== feature) expect(other.available).toBe(false);
      }
    },
  );

  it('prefers the driveable variant when a model exposes several', () => {
    const db = dbOf(post('SET_NR5G_BAND_CONFIG'), post('WAN_PERFORM_NR5G_BAND_LOCK'));
    const nr = resolved(db, 'nrBandLock');
    expect(nr.goformId).toBe('WAN_PERFORM_NR5G_BAND_LOCK');
    expect(nr.driveable).toBe(true);
  });

  it('reports an undriveable variant as available but not driveable', () => {
    const nr = resolved(dbOf(post('SET_NR5G_BAND_CONFIG')), 'nrBandLock');
    expect(nr.available).toBe(true);
    expect(nr.goformId).toBe('SET_NR5G_BAND_CONFIG');
    expect(nr.driveable).toBe(false);
  });

  it('ignores GET commands that share an id with a lock action', () => {
    const db = dbOf(post('BAND_SELECT', { method: 'GET', mutating: false }));
    expect(resolved(db, 'lteBandLock').available).toBe(false);
  });

  it('carries the matched command confidence through for the UI gate', () => {
    const db = dbOf(post('LTE_LOCK_CELL_SET', { confidence: 'verified', source: 'seed' }));
    const cell = resolved(db, 'lteCellLock');
    expect(cell.confidence).toBe('verified');
    expect(cell.command?.id).toBe('LTE_LOCK_CELL_SET');
  });

  it('MC801A1 pipeline: crawl → parse → merge resolves NR cell lock as absent', () => {
    // The reference firmware's service.js has no NR5G_LOCK_CELL_SET.
    const js = [
      {
        file: 'service.js',
        content: 'send({ goformId: "BAND_SELECT" }); send({ goformId: "LTE_LOCK_CELL_SET" });',
      },
    ];
    const db = buildDatabase(parseJavaScript(js));
    expect(resolved(db, 'lteBandLock').available).toBe(true);
    expect(resolved(db, 'nrCellLock').available).toBe(false);
  });

  it('MC801A1 pipeline: a firmware that ships NR5G_LOCK_CELL_SET unlocks the feature', () => {
    const js = [{ file: 'service.js', content: 'send({ goformId: "NR5G_LOCK_CELL_SET" });' }];
    const db = buildDatabase(parseJavaScript(js));
    const nrCell = resolved(db, 'nrCellLock');
    expect(nrCell.available).toBe(true);
    expect(nrCell.goformId).toBe('NR5G_LOCK_CELL_SET');
    expect(nrCell.driveable).toBe(true);
    // Discovered-only, so it must stay behind the experimental confidence gate.
    expect(nrCell.confidence).toBe('experimental');
  });
});
