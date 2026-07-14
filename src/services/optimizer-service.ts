import type { GoformClient } from '@/api';
import type { GoformSetResult, NeighborCell } from '@/types';
import {
  averageSamples,
  sampleFromSnapshot,
  scoreGaming,
  scoreSample,
  type LatencyStats,
  type OptGoal,
  type RadioSample,
} from '@/signals/optimizer';
import { formatLteBand, formatNrBand } from '@/signals/band-mask';
import { readRadioSnapshot } from './radio-service';
import {
  lockLteBands,
  lockNrBands,
  lockLteCell,
  unlockLteCell,
  revertToAuto,
} from './lock-service';

/**
 * The auto-optimizer runner. It benchmarks a list of candidates by locking each
 * one, letting the modem settle, sampling the radio a few times, and scoring the
 * average. Everything is driven through the verified lock commands; a progress
 * callback and an AbortSignal make it cancellable from the UI.
 */

export type CandidateKind = 'nr-band' | 'lte-band' | 'lte-cell' | 'auto';

export interface Candidate {
  id: string;
  label: string;
  kind: CandidateKind;
  apply: (client: GoformClient) => Promise<GoformSetResult>;
}

export interface BenchResult {
  candidate: Candidate;
  sample: RadioSample;
  latency?: LatencyStats;
  score: number;
  applied: boolean;
}

export type OptPhase = 'applying' | 'settling' | 'sampling' | 'candidate-done' | 'complete';

export interface OptProgress {
  phase: OptPhase;
  index: number;
  total: number;
  candidate?: Candidate;
  result?: BenchResult;
}

export interface OptOptions {
  goal: OptGoal;
  settleMs?: number;
  samples?: number;
  sampleIntervalMs?: number;
  /** Gaming mode: measures latency for each candidate after it settles. */
  latencyProbe?: (signal?: AbortSignal) => Promise<LatencyStats>;
  onProgress?: (p: OptProgress) => void;
  signal?: AbortSignal;
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });

async function sampleRadio(
  client: GoformClient,
  count: number,
  intervalMs: number,
  signal?: AbortSignal,
): Promise<RadioSample> {
  const samples: RadioSample[] = [];
  for (let i = 0; i < count; i += 1) {
    samples.push(sampleFromSnapshot(await readRadioSnapshot(client)));
    if (i < count - 1) await delay(intervalMs, signal);
  }
  return averageSamples(samples);
}

export async function runOptimization(
  client: GoformClient,
  candidates: Candidate[],
  options: OptOptions,
): Promise<BenchResult[]> {
  const {
    goal,
    settleMs = 6000,
    samples = 4,
    sampleIntervalMs = 1500,
    latencyProbe,
    onProgress,
    signal,
  } = options;
  const results: BenchResult[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const candidate = candidates[index]!;

    onProgress?.({ phase: 'applying', index, total: candidates.length, candidate });
    try {
      await candidate.apply(client);
    } catch {
      results.push({ candidate, sample: emptySample(), score: 0, applied: false });
      continue;
    }

    onProgress?.({ phase: 'settling', index, total: candidates.length, candidate });
    await delay(settleMs, signal);

    onProgress?.({ phase: 'sampling', index, total: candidates.length, candidate });
    const sample = await sampleRadio(client, samples, sampleIntervalMs, signal);
    const latency = latencyProbe ? await latencyProbe(signal) : undefined;
    const score =
      goal === 'gaming' && latency ? scoreGaming(sample, latency) : scoreSample(goal, sample);
    const result: BenchResult = { candidate, sample, score, applied: false, ...(latency ? { latency } : {}) };
    results.push(result);
    onProgress?.({ phase: 'candidate-done', index, total: candidates.length, candidate, result });
  }

  results.sort((a, b) => b.score - a.score);
  onProgress?.({ phase: 'complete', index: candidates.length, total: candidates.length });
  return results;
}

/** Re-apply a candidate (e.g. the winner) and mark it applied. */
export async function applyCandidate(client: GoformClient, candidate: Candidate): Promise<void> {
  await candidate.apply(client);
}

function emptySample(): RadioSample {
  return { sinr: null, rsrp: null, rsrq: null, caActive: false, band: null, mode: 'NO_SERVICE', bandwidthMhz: null };
}

// --- candidate builders ------------------------------------------------------

/**
 * The "no lock" baseline: full auto (all bands + CA + 5G). Included in every
 * benchmark so the optimizer can recommend keeping auto — which is almost always
 * fastest, because locking a single band sacrifices carrier aggregation.
 */
export function autoCandidate(): Candidate {
  return {
    id: 'auto',
    label: 'Auto (all bands + CA)',
    kind: 'auto',
    apply: async (client) => {
      await revertToAuto(client);
      return { result: 'success' };
    },
  };
}

export function nrBandCandidates(bands: number[]): Candidate[] {
  return bands.map((band) => ({
    id: `nr-${band}`,
    label: formatNrBand(band),
    kind: 'nr-band',
    apply: (client) => lockNrBands(client, [band]),
  }));
}

export function lteBandCandidates(bands: number[]): Candidate[] {
  return bands.map((band) => ({
    id: `lte-${band}`,
    label: formatLteBand(band),
    kind: 'lte-band',
    apply: (client) => lockLteBands(client, [band]),
  }));
}

export function cellCandidates(cells: NeighborCell[]): Candidate[] {
  return cells
    .filter((c) => c.rat === 'LTE' && c.pci !== null && c.earfcnArfcn !== null)
    .map((c) => ({
      id: `cell-${c.pci}-${c.earfcnArfcn}`,
      label: `PCI ${c.pci} @ ${c.earfcnArfcn}`,
      kind: 'lte-cell' as const,
      apply: (client: GoformClient) =>
        lockLteCell(client, { pci: c.pci!, earfcn: c.earfcnArfcn! }),
    }));
}

/** Reset: clear the LTE cell lock (used as an optimizer "start from scratch"). */
export function resetLocks(client: GoformClient): Promise<GoformSetResult> {
  return unlockLteCell(client);
}
