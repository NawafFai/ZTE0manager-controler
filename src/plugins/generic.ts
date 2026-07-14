import type { RouterPlugin } from './types';

/**
 * Fallback plugin for any ZTE router we don't have a dedicated adapter for.
 * It enables the broadly-supported feature set and lets runtime discovery
 * decide the rest, so a brand-new model still works out of the box.
 */
export const genericPlugin: RouterPlugin = {
  id: 'generic-zte',
  name: 'Generic ZTE',
  models: [],
  capabilities: () => ({
    lteBandLock: true,
    lteCellLock: true,
    nrBandLock: true,
    nrCellLock: false,
    towerScan: true,
    carrierAggregation: true,
    temperature: true,
    thermalControl: false,
  }),
};
