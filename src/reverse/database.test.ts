import { describe, expect, it } from 'vitest';
import { mergeCommands } from './database';
import type { ApiCommand } from '@/types';

const seedCmd: ApiCommand = {
  id: 'LTE_LOCK_CELL_SET',
  method: 'POST',
  category: 'lte',
  confidence: 'inferred',
  source: 'seed',
  mutating: true,
  params: [{ name: 'lte_pci_lock', required: true }],
  foundIn: ['service.js'],
};

const discoveredCmd: ApiCommand = {
  id: 'LTE_LOCK_CELL_SET',
  method: 'POST',
  category: 'lte',
  confidence: 'experimental',
  source: 'discovered',
  mutating: true,
  params: [],
  foundIn: ['main.js'],
};

describe('mergeCommands', () => {
  it('deduplicates by method:id and unions provenance', () => {
    const merged = mergeCommands([seedCmd], [discoveredCmd]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.foundIn).toEqual(expect.arrayContaining(['service.js', 'main.js']));
  });

  it('promotes seed+discovered corroboration to verified', () => {
    const merged = mergeCommands([seedCmd], [discoveredCmd]);
    expect(merged[0]!.confidence).toBe('verified');
  });

  it('keeps documented params from the higher-confidence record', () => {
    const merged = mergeCommands([seedCmd], [discoveredCmd]);
    expect(merged[0]!.params).toHaveLength(1);
  });
});
