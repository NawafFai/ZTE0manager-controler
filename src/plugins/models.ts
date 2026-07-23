import type { RouterPlugin } from './types';
import { huaweiH155Plugin } from './huawei-h155';

/**
 * Concrete model families. Each is a thin declaration — capabilities plus
 * matched model strings. All heavy lifting is shared in the core layers, so
 * adding a new router is a few lines here (see docs/PLUGIN_GUIDE.md).
 */

const fullCapabilities = () => ({
  lteBandLock: true,
  lteCellLock: true,
  nrBandLock: true,
  nrCellLock: true,
  towerScan: true,
  carrierAggregation: true,
  temperature: true,
  thermalControl: true,
});

/** MC801A / MC801A1 — the reference device from the knowledge base. */
export const mc801aPlugin: RouterPlugin = {
  id: 'mc801a',
  name: 'ZTE MC801A / MC801A1',
  models: ['MC801A', 'MC801A1'],
  authStrategyId: 'classic-zte',
  capabilities: () => ({
    ...fullCapabilities(),
    // Reference device is 5G NSA; SA cell-lock unverified on this firmware.
    nrCellLock: false,
  }),
};

export const mc888Plugin: RouterPlugin = {
  id: 'mc888',
  name: 'ZTE MC888 (Pro / Ultra)',
  // Prefix match also covers "MC888 Pro" / "MC888 Ultra".
  models: ['MC888'],
  authStrategyId: 'classic-zte',
  capabilities: fullCapabilities,
};

export const mc889Plugin: RouterPlugin = {
  id: 'mc889',
  name: 'ZTE MC889 / MC889A',
  models: ['MC889', 'MC889A'],
  authStrategyId: 'classic-zte',
  capabilities: fullCapabilities,
};

export const mc8020Plugin: RouterPlugin = {
  id: 'mc8020',
  name: 'ZTE MC8020',
  models: ['MC8020'],
  authStrategyId: 'classic-zte',
  capabilities: fullCapabilities,
};

export const MODEL_PLUGINS: readonly RouterPlugin[] = [
  mc801aPlugin,
  mc888Plugin,
  mc889Plugin,
  mc8020Plugin,
  huaweiH155Plugin,
];
