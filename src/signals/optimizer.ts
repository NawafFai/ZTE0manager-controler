import type { RadioSnapshot } from '@/types';

/**
 * Optimization scoring.
 *
 * The optimizer benchmarks candidate bands/cells by locking each briefly and
 * sampling the radio, then scores every sample according to the user's goal:
 *   - speed:     SINR dominates (throughput tracks SINR), plus bandwidth/CA.
 *   - stability: RSRP dominates (coverage margin), SINR secondary.
 *   - tower:     "emptiest" cell ≈ highest SINR (a congested/interfered cell
 *                shows low SINR even with strong RSRP).
 * Scoring is pure and unit-tested; the runner (services) supplies the samples.
 */

export type OptGoal = 'speed' | 'stability' | 'tower' | 'gaming';

/** Latency measurement for the gaming goal. */
export interface LatencyStats {
  avgMs: number | null;
  jitterMs: number | null;
  lossPct: number;
  samples: number;
}

export interface RadioSample {
  sinr: number | null;
  rsrp: number | null;
  rsrq: number | null;
  caActive: boolean;
  band: string | null;
  mode: string;
  bandwidthMhz: number | null;
}

/**
 * Reduce raw round-trip times to comparable latency stats.
 *  - `avgMs` is the MEDIAN: a single slow request (retransmit, radio wake-up)
 *    must not drag the figure away from the ping a game actually sees.
 *  - `jitterMs` is the mean absolute difference between consecutive samples
 *    (RFC 3550 style), not the standard deviation — a constant offset is not jitter.
 */
export function summarizeLatency(timesMs: number[], attempted: number): LatencyStats {
  const lossPct = attempted > 0 ? ((attempted - timesMs.length) / attempted) * 100 : 100;
  if (timesMs.length === 0) return { avgMs: null, jitterMs: null, lossPct, samples: attempted };
  const sorted = [...timesMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const avgMs = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  let jitterMs: number | null = null;
  if (timesMs.length > 1) {
    let sum = 0;
    for (let i = 1; i < timesMs.length; i += 1) sum += Math.abs(timesMs[i]! - timesMs[i - 1]!);
    jitterMs = sum / (timesMs.length - 1);
  }
  return { avgMs, jitterMs, lossPct, samples: attempted };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function norm(value: number | null, min: number, max: number): number {
  if (value === null || Number.isNaN(value)) return 0;
  return clamp01((value - min) / (max - min));
}

/** Derive a single comparable sample from a full snapshot (prefer NR when up). */
export function sampleFromSnapshot(snap: RadioSnapshot): RadioSample {
  const useNr = snap.nr.pci !== null || snap.nr.rsrp.value !== null;
  const sinr = (useNr ? snap.nr.sinr.value : null) ?? snap.lte.sinr.value;
  const rsrp = (useNr ? snap.nr.rsrp.value : null) ?? snap.lte.rsrp.value;
  const rsrq = (useNr ? snap.nr.rsrq.value : null) ?? snap.lte.rsrq.value;
  return {
    sinr,
    rsrp,
    rsrq,
    caActive: snap.caActive,
    band: (useNr ? snap.nr.band : snap.lte.band) ?? snap.lte.band,
    mode: snap.mode,
    bandwidthMhz: (useNr ? snap.nr.bandwidthMhz : snap.lte.bandwidthMhz) ?? snap.lte.bandwidthMhz,
  };
}

export function averageSamples(samples: RadioSample[]): RadioSample {
  const nums = (pick: (s: RadioSample) => number | null): number | null => {
    const vals = samples.map(pick).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const last = samples[samples.length - 1];
  return {
    sinr: nums((s) => s.sinr),
    rsrp: nums((s) => s.rsrp),
    rsrq: nums((s) => s.rsrq),
    caActive: samples.some((s) => s.caActive),
    band: last?.band ?? null,
    mode: last?.mode ?? 'UNKNOWN',
    bandwidthMhz: nums((s) => s.bandwidthMhz),
  };
}

/** 0–100 score for a sample under a goal. Higher is better. */
export function scoreSample(goal: OptGoal, s: RadioSample): number {
  // No service → worst score, so unsupported bands are naturally rejected.
  if (s.sinr === null && s.rsrp === null) return 0;

  const nSinr = norm(s.sinr, -5, 30);
  const nRsrp = norm(s.rsrp, -120, -70);
  const ca = s.caActive ? 1 : 0;
  const bw = norm(s.bandwidthMhz, 5, 100);

  let score: number;
  switch (goal) {
    case 'speed':
      score = 0.55 * nSinr + 0.2 * nRsrp + 0.15 * bw + 0.1 * ca;
      break;
    case 'stability':
    case 'gaming': // without a latency probe, gaming ≈ stability
      score = 0.5 * nRsrp + 0.4 * nSinr + 0.1 * ca;
      break;
    case 'tower':
      score = 0.8 * nSinr + 0.2 * nRsrp;
      break;
  }
  return Math.round(score * 100);
}

/**
 * Gaming score: latency dominates (that's the ping you feel), then jitter and
 * packet loss (stutter/rubber-banding), then radio stability (drops). A dead
 * link (no service or 100% loss) scores 0.
 */
export function scoreGaming(s: RadioSample, l: LatencyStats): number {
  if ((s.sinr === null && s.rsrp === null) || l.lossPct >= 100) return 0;
  const nLatency = 1 - norm(l.avgMs, 20, 200); // 20ms → 1.0, 200ms → 0
  const nJitter = 1 - norm(l.jitterMs, 2, 60);
  const nLoss = 1 - clamp01(l.lossPct / 20); // 0% → 1, ≥20% → 0
  const nStability = 0.5 * norm(s.rsrp, -115, -75) + 0.5 * norm(s.sinr, -5, 30);
  const score = 0.45 * nLatency + 0.2 * nJitter + 0.2 * nLoss + 0.15 * nStability;
  return Math.round(score * 100);
}
