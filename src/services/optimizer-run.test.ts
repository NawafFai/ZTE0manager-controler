import { afterEach, describe, expect, it } from 'vitest';
import { startMockRouter, type MockRouter } from '@/test/mock-router';
import { GoformClient } from '@/api';
import { summarizeLatency, type LatencyStats } from '@/signals/optimizer';
import {
  chooseWinner,
  isConnectionHealthy,
  runOptimization,
  WIN_MARGIN,
  type BenchResult,
  type Candidate,
} from '@/services';

let router: MockRouter | undefined;
afterEach(async () => {
  await router?.close();
  router = undefined;
});

const result = (id: string, kind: Candidate['kind'], score: number): BenchResult => ({
  candidate: { id, label: id, kind, apply: async () => ({ result: 'success' }) },
  sample: { sinr: 10, rsrp: -90, rsrq: null, caActive: false, band: null, mode: 'LTE', bandwidthMhz: null },
  score,
  applied: false,
});

describe('summarizeLatency', () => {
  it('uses the median so one slow outlier does not inflate the ping', () => {
    const s = summarizeLatency([50, 52, 48, 400, 51], 5);
    expect(s.avgMs).toBe(51);
    expect(s.lossPct).toBe(0);
  });

  it('measures jitter as consecutive-sample variation, not constant offset', () => {
    expect(summarizeLatency([100, 100, 100, 100], 4).jitterMs).toBe(0);
    expect(summarizeLatency([50, 70, 50, 70], 4).jitterMs).toBe(20);
  });

  it('reports 100% loss when nothing came back', () => {
    expect(summarizeLatency([], 6)).toEqual({ avgMs: null, jitterMs: null, lossPct: 100, samples: 6 });
  });

  it('counts lost requests', () => {
    expect(summarizeLatency([40, 42], 4).lossPct).toBe(50);
  });
});

describe('chooseWinner', () => {
  it('keeps Auto unless a lock clearly beats it', () => {
    const auto = result('auto', 'auto', 60);
    const lock = result('b3', 'lte-band', 60 + WIN_MARGIN - 1);
    expect(chooseWinner([lock, auto])?.candidate.kind).toBe('auto');
  });

  it('picks a lock that beats Auto by the margin', () => {
    const auto = result('auto', 'auto', 60);
    const lock = result('b3', 'lte-band', 60 + WIN_MARGIN);
    expect(chooseWinner([lock, auto])?.candidate.id).toBe('b3');
  });

  it('picks the best when the Auto baseline is unusable', () => {
    const auto = result('auto', 'auto', 0);
    const lock = result('b1', 'lte-band', 30);
    expect(chooseWinner([lock, auto])?.candidate.id).toBe('b1');
  });

  it('returns null when nothing had service', () => {
    expect(chooseWinner([result('auto', 'auto', 0), result('b1', 'lte-band', 0)])).toBeNull();
  });
});

describe('runOptimization link readiness', () => {
  it('waits for the data link to come back instead of measuring a re-attaching modem', async () => {
    router = await startMockRouter();
    const r = router;
    const client = new GoformClient({ baseUrl: r.url });

    // Applying this candidate drops the link for 500 ms, like a real band switch.
    const flappy: Candidate = {
      id: 'b3',
      label: 'B3',
      kind: 'lte-band',
      apply: async () => {
        r.values.ppp_status = 'ppp_disconnected';
        setTimeout(() => (r.values.ppp_status = 'ipv4_ipv6_connected'), 500);
        return { result: 'success' };
      },
    };
    // The probe only "succeeds" while the link is up.
    const latencyProbe = async (): Promise<LatencyStats> =>
      r.values.ppp_status === 'ipv4_ipv6_connected'
        ? { avgMs: 50, jitterMs: 3, lossPct: 0, samples: 6 }
        : { avgMs: null, jitterMs: null, lossPct: 100, samples: 6 };

    const [res] = await runOptimization(client, [flappy], {
      goal: 'gaming',
      settleMs: 50,
      linkPollMs: 100,
      linkTimeoutMs: 5000,
      samples: 1,
      sampleIntervalMs: 0,
      latencyProbe,
    });

    expect(res!.latency?.lossPct).toBe(0);
    expect(res!.score).toBeGreaterThan(0);
  });
});

describe('isConnectionHealthy', () => {
  it.each([
    ['ppp_connected', true],
    ['ipv4_ipv6_connected', true],
    ['ipv4_connected', true],
    ['ppp_disconnected', false],
    ['ppp_connecting', false],
    ['ppp_disconnecting', false],
    ['', false],
  ])('ppp_status %j → healthy=%s', async (ppp, expected) => {
    router = await startMockRouter({ ppp_status: ppp });
    const client = new GoformClient({ baseUrl: router.url });
    expect(await isConnectionHealthy(client)).toBe(expected);
  });
});
