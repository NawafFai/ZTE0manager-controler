import { describe, expect, it } from 'vitest';
import {
  scoreSample,
  scoreGaming,
  averageSamples,
  type LatencyStats,
  type RadioSample,
} from './optimizer';

const sample = (over: Partial<RadioSample>): RadioSample => ({
  sinr: null,
  rsrp: null,
  rsrq: null,
  caActive: false,
  band: null,
  mode: 'ENDC',
  bandwidthMhz: null,
  ...over,
});

describe('optimizer scoring', () => {
  it('gives no-service samples a zero score', () => {
    expect(scoreSample('speed', sample({}))).toBe(0);
  });

  it('ranks high SINR above low SINR for speed', () => {
    const good = scoreSample('speed', sample({ sinr: 25, rsrp: -85 }));
    const bad = scoreSample('speed', sample({ sinr: 2, rsrp: -85 }));
    expect(good).toBeGreaterThan(bad);
  });

  it('weights RSRP more than SINR for stability', () => {
    const strongWeakQuality = scoreSample('stability', sample({ sinr: 5, rsrp: -75 }));
    const weakStrongQuality = scoreSample('stability', sample({ sinr: 25, rsrp: -115 }));
    expect(strongWeakQuality).toBeGreaterThan(weakStrongQuality);
  });

  it('tower goal is driven by SINR (congestion proxy)', () => {
    const empty = scoreSample('tower', sample({ sinr: 24, rsrp: -100 }));
    const congested = scoreSample('tower', sample({ sinr: 3, rsrp: -80 }));
    expect(empty).toBeGreaterThan(congested);
  });

  it('gaming prefers low ping over high ping', () => {
    const s = sample({ sinr: 15, rsrp: -90 });
    const lat = (avgMs: number, loss = 0): LatencyStats => ({
      avgMs,
      jitterMs: 5,
      lossPct: loss,
      samples: 6,
    });
    expect(scoreGaming(s, lat(30))).toBeGreaterThan(scoreGaming(s, lat(150)));
  });

  it('gaming penalizes packet loss heavily', () => {
    const s = sample({ sinr: 15, rsrp: -90 });
    const clean = scoreGaming(s, { avgMs: 40, jitterMs: 5, lossPct: 0, samples: 6 });
    const lossy = scoreGaming(s, { avgMs: 40, jitterMs: 5, lossPct: 30, samples: 6 });
    expect(lossy).toBeLessThan(clean);
    expect(scoreGaming(s, { avgMs: 40, jitterMs: 5, lossPct: 100, samples: 6 })).toBe(0);
  });

  it('averages numeric fields and ignores nulls', () => {
    const avg = averageSamples([sample({ sinr: 10 }), sample({ sinr: 20 }), sample({ sinr: null })]);
    expect(avg.sinr).toBe(15);
  });
});
