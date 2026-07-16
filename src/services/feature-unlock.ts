import type { ApiCommand, ApiConfidence, ApiDatabase } from '@/types';

/**
 * Feature Unlock resolver — the "discovery-based, never hardcoded" core of the
 * Feature Unlock page.
 *
 * Different ZTE models implement the same logical feature with different
 * goformIds (e.g. NR band lock is `WAN_PERFORM_NR5G_BAND_LOCK` on the MC801A1
 * but `NR5G_BAND_SELECT` / `SET_NR5G_BAND_CONFIG` elsewhere — see
 * KNOWN_DISCOVERIES.md). So instead of assuming a command set, FEATURE_MAP
 * names every KNOWN implementation and a feature only becomes available when
 * one of its goformIds is actually present in the API database (seed knowledge
 * merged with commands crawled from the router's own JavaScript).
 *
 * `driveable` marks the candidates whose exact params lock-service implements.
 * A non-driveable match is still reported (available, but the UI must not
 * render an active control for it) so the user is pointed at the API Console
 * instead of being shown a dead — or worse, wrong — button.
 */

export type UnlockFeatureId =
  | 'lteBandLock'
  | 'lteCellLock'
  | 'nrBandLock'
  | 'nrCellLock'
  | 'networkMode';

export interface UnlockCandidate {
  goformId: string;
  /** True when lock-service implements this exact command + params. */
  driveable: boolean;
}

export interface UnlockFeatureSpec {
  feature: UnlockFeatureId;
  /** i18n key: `labelKey` = title, `${labelKey}.desc` = description. */
  labelKey: string;
  /** Known implementations across ZTE families, driveable/preferred first. */
  candidates: readonly UnlockCandidate[];
}

export const FEATURE_MAP: readonly UnlockFeatureSpec[] = [
  {
    feature: 'lteBandLock',
    labelKey: 'unlock.lteBand',
    candidates: [{ goformId: 'BAND_SELECT', driveable: true }],
  },
  {
    feature: 'lteCellLock',
    labelKey: 'unlock.lteCell',
    candidates: [{ goformId: 'LTE_LOCK_CELL_SET', driveable: true }],
  },
  {
    feature: 'nrBandLock',
    labelKey: 'unlock.nrBand',
    candidates: [
      { goformId: 'WAN_PERFORM_NR5G_BAND_LOCK', driveable: true },
      // Variants from the Easy Control APK (other models); params unverified.
      { goformId: 'NR5G_BAND_SELECT', driveable: false },
      { goformId: 'SET_NR5G_BAND_CONFIG', driveable: false },
    ],
  },
  {
    feature: 'nrCellLock',
    labelKey: 'unlock.nrCell',
    candidates: [{ goformId: 'NR5G_LOCK_CELL_SET', driveable: true }],
  },
  {
    feature: 'networkMode',
    labelKey: 'unlock.netmode',
    candidates: [{ goformId: 'SET_BEARER_PREFERENCE', driveable: true }],
  },
];

export interface ResolvedUnlockFeature {
  feature: UnlockFeatureId;
  labelKey: string;
  /** True when one of the candidate goformIds exists on this device. */
  available: boolean;
  /** The matched goformId, or null when unavailable on this model. */
  goformId: string | null;
  /** Confidence of the matched command, for the UI's confidence gate. */
  confidence: ApiConfidence | null;
  /** True when the app can safely fire the matched command. */
  driveable: boolean;
  /** All known candidate ids, for the "unavailable on this model" display. */
  candidates: string[];
  /** Full matched command record (provenance / params), when available. */
  command: ApiCommand | null;
}

function findPost(db: ApiDatabase, goformId: string): ApiCommand | undefined {
  return db.commands.find((c) => c.method === 'POST' && c.id === goformId);
}

/**
 * Resolve which unlockable features THIS device supports, from its database.
 * Pure: no I/O, no assumptions — candidates are matched in declaration order,
 * so a model exposing several variants resolves to the proven one.
 */
export function resolveUnlockableFeatures(db: ApiDatabase): ResolvedUnlockFeature[] {
  return FEATURE_MAP.map((spec) => {
    const candidates = spec.candidates.map((c) => c.goformId);
    for (const candidate of spec.candidates) {
      const command = findPost(db, candidate.goformId);
      if (command) {
        return {
          feature: spec.feature,
          labelKey: spec.labelKey,
          available: true,
          goformId: command.id,
          confidence: command.confidence,
          driveable: candidate.driveable,
          candidates,
          command,
        };
      }
    }
    return {
      feature: spec.feature,
      labelKey: spec.labelKey,
      available: false,
      goformId: null,
      confidence: null,
      driveable: false,
      candidates,
      command: null,
    };
  });
}
