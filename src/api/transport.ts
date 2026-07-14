import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Platform-aware HTTP transport for the goform client.
 *
 * - Web / Electron: normal `fetch`. Requests are same-origin (the Vite dev proxy
 *   or the Electron local server forwards to the router and rewrites Referer).
 * - Native (Android / iOS via Capacitor): there is NO proxy, so we talk to the
 *   router DIRECTLY using CapacitorHttp — a native HTTP client that bypasses the
 *   browser CORS sandbox, lets us set the Referer/Origin the firmware requires,
 *   and persists the login cookie in the native cookie store.
 *
 * This is what makes the exact same React app work as a mobile app.
 */

export interface HttpResult {
  ok: boolean;
  status: number;
  text: string;
}

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function fetchTransport(req: HttpRequest): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  const onAbort = () => controller.abort();
  req.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      credentials: 'include',
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
  }
}

async function nativeTransport(req: HttpRequest): Promise<HttpResult> {
  // Direct-to-router: derive the Referer/Origin from the target so the firmware
  // CSRF check passes (same rule the desktop proxy applies).
  const origin = new URL(req.url).origin;
  const res = await CapacitorHttp.request({
    url: req.url,
    method: req.method,
    headers: {
      ...(req.headers ?? {}),
      Referer: `${origin}/index.html`,
      Origin: origin,
    },
    data: req.body,
    connectTimeout: req.timeoutMs,
    readTimeout: req.timeoutMs,
  });
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
  return { ok: res.status >= 200 && res.status < 400, status: res.status, text };
}

export function httpRequest(req: HttpRequest): Promise<HttpResult> {
  return isNativePlatform() ? nativeTransport(req) : fetchTransport(req);
}

/** Default router address used on native (no proxy) — editable in Settings. */
export const DEFAULT_ROUTER_URL = 'http://192.168.0.1';
