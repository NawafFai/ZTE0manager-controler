import type { LatencyStats } from '@/signals/optimizer';

/**
 * Browser-based latency probe used by the gaming optimizer.
 *
 * We time small no-cors requests to a reachable HTTP host; the round-trip goes
 * through the router's cellular link, so comparing the average/jitter/loss
 * across locked bands/cells reveals which one games best. This is the ONLY part
 * of the app that touches an external host, and only during a gaming run — the
 * target is user-configurable. A connectivity endpoint (returns HTTP 204) is a
 * good low-overhead default.
 */

export const DEFAULT_PING_TARGET = 'https://www.gstatic.com/generate_204';

function normalizeTarget(input: string): string {
  const s = input.trim();
  if (!s) return DEFAULT_PING_TARGET;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export async function measureLatency(
  target: string,
  count = 6,
  timeoutMs = 2500,
  signal?: AbortSignal,
): Promise<LatencyStats> {
  const url = normalizeTarget(target);
  const times: number[] = [];
  let lost = 0;

  for (let i = 0; i < count; i += 1) {
    if (signal?.aborted) break;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();
    try {
      await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}${i}`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      times.push(performance.now() - start);
    } catch {
      lost += 1;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    // small gap so we sample jitter rather than back-to-back
    await new Promise((r) => setTimeout(r, 150));
  }

  const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const jitterMs =
    times.length > 1 && avgMs !== null
      ? Math.sqrt(times.reduce((a, b) => a + (b - avgMs) ** 2, 0) / times.length)
      : null;

  return { avgMs, jitterMs, lossPct: (lost / count) * 100, samples: count };
}
