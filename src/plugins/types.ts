import type { DeviceInfo } from '@/types';
import type { AuthStrategy } from '@/api/auth';

/**
 * Feature flags let the UI hide capabilities a given model/firmware does not
 * support. They are populated by a plugin's static declaration and refined at
 * runtime by the reverse-engineering engine (discovered commands).
 */
export interface RouterCapabilities {
  lteBandLock: boolean;
  lteCellLock: boolean;
  nrBandLock: boolean;
  nrCellLock: boolean;
  towerScan: boolean;
  carrierAggregation: boolean;
  temperature: boolean;
  thermalControl: boolean;
}

export const NO_CAPABILITIES: RouterCapabilities = {
  lteBandLock: false,
  lteCellLock: false,
  nrBandLock: false,
  nrCellLock: false,
  towerScan: false,
  carrierAggregation: false,
  temperature: false,
  thermalControl: false,
};

/**
 * A router plugin adapts one model family. It never re-implements transport or
 * signal logic — it only supplies model-specific knowledge:
 *   - which firmware/model strings it matches,
 *   - which auth strategy that family uses,
 *   - baseline capabilities,
 *   - optional overrides for command names that differ on this family.
 */
export interface RouterPlugin {
  /** Stable identifier, e.g. "mc801a". */
  readonly id: string;
  /** Human-readable family name. */
  readonly name: string;
  /** Model strings this plugin handles (matched case-insensitively, prefix). */
  readonly models: readonly string[];
  /** Auth strategy id (see AUTH_STRATEGIES). Defaults to classic. */
  readonly authStrategyId?: string;

  /** Baseline capabilities before runtime discovery refines them. */
  capabilities(device: DeviceInfo): RouterCapabilities;

  /**
   * Optional per-family remapping of logical command names to firmware command
   * names, for the rare cases where a family renames a field.
   */
  commandAliases?: Readonly<Record<string, string>>;

  /** Optional custom matcher when model-string matching is insufficient. */
  matches?(device: DeviceInfo): boolean;
}

export interface ResolvedRouter {
  plugin: RouterPlugin;
  authStrategy: AuthStrategy;
  capabilities: RouterCapabilities;
}
