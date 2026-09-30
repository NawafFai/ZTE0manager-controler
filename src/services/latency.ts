import { summarizeLatency, type LatencyStats } from '@/signals/optimizer';

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

/** One timed request; resolves to the round-trip in ms, or null on timeout/error. */
async function timedRequest(
  url: string,
  nonce: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${nonce}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return performance.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const WARMUP_ATTEMPTS = 6;

/**
 * The first request on a fresh connection also pays DNS + TCP + TLS (3–4 round
 * trips) and the radio may still be waking up right after a band switch. That
 * cost is not the ping a game sees, so we first send UNTIMED warm-up requests
 * until one succeeds, and only then measure `count` requests on the warm
 * connection. If no warm-up ever succeeds the link is dead → 100% loss.
 */
export async function measureLatency(
  target: string,
  count = 6,
  timeoutMs = 3000,
  signal?: AbortSignal,
): Promise<LatencyStats> {
  const url = normalizeTarget(target);

  let warm = false;
  for (let i = 0; i < WARMUP_ATTEMPTS && !warm; i += 1) {
    if (signal?.aborted) break;
    warm = (await timedRequest(url, `w${Date.now()}${i}`, timeoutMs, signal)) !== null;
  }
  if (!warm) return summarizeLatency([], count);

  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (signal?.aborted) break;
    const t = await timedRequest(url, `${Date.now()}${i}`, timeoutMs, signal);
    if (t !== null) times.push(t);
    // small gap so we sample jitter rather than back-to-back
    await new Promise((r) => setTimeout(r, 150));
  }
  return summarizeLatency(times, count);
}
