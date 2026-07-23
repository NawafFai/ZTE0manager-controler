import {
  GoformError,
  type GetCommandRequest,
  type GoformGetResult,
  type GoformSetResult,
  type SetCommandRequest,
} from '@/types';
import { GoformClient, type GoformClientConfig, type GoformTrafficEvent } from './goform-client';
import { HiLinkApiError, buildHiLinkRequest, parseHiLinkXml } from './hilink-xml';
import { randomHexNonce, scramClientProof } from './hilink-crypto';
import { hiLinkToCommands, isHiLinkLoggedIn, type HiLinkState } from './hilink-map';
import {
  LTE_BAND_ALL,
  NET_MODE_AUTO,
  NET_MODE_LTE_ONLY,
  lteMaskToHuawei,
  netModeRequest,
  nrAllMask,
  nrListToHuaweiMask,
  parseNetMode,
  type NetMode,
} from './hilink-net';

/**
 * Huawei HiLink adapter (5G CPE 5 / H155-383 and friends, at 192.168.8.1).
 *
 * The whole app speaks ZTE goform command names through the GoformClient
 * surface. This client keeps that contract — `get({cmd})` / `set({goformId})`
 * — but fulfils it against the Huawei XML API instead:
 *
 *   - reads are served from a short-lived merged snapshot of the HiLink
 *     endpoints, translated to ZTE keys by hilink-map.ts, so the signal
 *     engine, dashboard and device pages work unchanged;
 *   - login implements Huawei's SCRAM (challenge_login/authentication_login);
 *   - only REBOOT_DEVICE / LOGOUT are supported as actions — everything else
 *     (band/cell locks) reports failure, and the plugin's capabilities hide
 *     those controls anyway.
 *
 * Transport is plain same-origin fetch: in Electron/dev the local proxy
 * forwards `/api` to the router, shares the SessionID cookie, and passes the
 * __RequestVerificationToken response headers through untouched.
 */

/**
 * HiLink error codes that mean "session/token stale — refresh and retry".
 * (100003 "no rights" is NOT here: it means the endpoint needs login and is
 * handled as data-unavailable by tryGet.)
 */
const RETRYABLE_CODES = new Set(['125001', '125002', '125003']);

const SNAPSHOT_TTL_MS = 900;

export interface HiLinkLoginResult {
  ok: boolean;
  code: string | undefined;
}

export class HiLinkClient extends GoformClient {
  private readonly apiBase: string;
  private readonly apiTimeoutMs: number;
  private readonly emitTraffic: ((event: GoformTrafficEvent) => void) | undefined;
  private trafficSeq = 0;

  private csrfToken: string | null = null;
  private snapshot: { at: number; data: Record<string, string> } | null = null;
  private inflight: Promise<Record<string, string>> | null = null;

  constructor(config: GoformClientConfig = {}) {
    super(config);
    this.apiBase = config.baseUrl ?? '';
    this.apiTimeoutMs = config.timeoutMs ?? 10_000;
    this.emitTraffic = config.onTraffic;
  }

  /** Cheap protocol probe: does this host answer the HiLink device endpoint? */
  static async probe(baseUrl: string, timeoutMs = 6_000): Promise<boolean> {
    try {
      const client = new HiLinkClient({ baseUrl, timeoutMs });
      const basic = await client.apiGet('/api/device/basic_information');
      return !!(basic.devicename || basic.spreadname_en || basic.DeviceName);
    } catch {
      return false;
    }
  }

  // --- GoformClient surface -------------------------------------------------

  override async get(request: GetCommandRequest): Promise<GoformGetResult> {
    const cmds = Array.isArray(request.cmd) ? request.cmd : [request.cmd];
    const state = await this.commandMap();
    const out: GoformGetResult = {};
    for (const cmd of cmds) {
      if (state[cmd] !== undefined) out[cmd] = state[cmd]!;
    }
    return out;
  }

  override async set(request: SetCommandRequest): Promise<GoformSetResult> {
    const p = request.params ?? {};
    switch (request.goformId) {
      case 'REBOOT_DEVICE': {
        await this.apiPost('/api/device/control', { Control: 1 });
        this.invalidate();
        return { result: 'success' };
      }
      case 'LOGOUT': {
        await this.apiPost('/api/user/logout', { Logout: 1 });
        this.invalidate();
        return { result: 'success' };
      }

      // --- LTE band lock → net-mode LTEBand (preserve RAT + other bands) ---
      case 'BAND_SELECT': {
        const lteBand =
          String(p.is_lte_band) === '1' ? lteMaskToHuawei(String(p.lte_band_mask)) : LTE_BAND_ALL;
        return this.applyNetMode((m) => ({ ...m, lteBand }));
      }

      // --- NR band lock → net-mode NRBand ---
      case 'WAN_PERFORM_NR5G_BAND_LOCK': {
        const list = String(p.nr5g_band_mask ?? '');
        const nrBand = list ? nrListToHuaweiMask(list) : nrAllMask();
        return this.applyNetMode((m) => ({ ...m, nrBand }));
      }

      // --- RAT preference (Only_LTE / auto) → NetworkMode ---
      case 'SET_BEARER_PREFERENCE': {
        const pref = String(p.BearerPreference ?? '').toUpperCase();
        const networkMode = pref.includes('LTE') && !pref.includes('NR') ? NET_MODE_LTE_ONLY : NET_MODE_AUTO;
        return this.applyNetMode((m) => ({ ...m, networkMode }));
      }

      default:
        // Cell lock (LTE_LOCK_CELL_SET) and other ZTE-only goformIds have no
        // verified HiLink equivalent on this firmware yet — report failure so
        // the optimizer skips them rather than silently doing nothing.
        return { result: 'failure' };
    }
  }

  /**
   * Read-modify-write on /api/net/net-mode. Reads the current mode so a single
   * changed field (e.g. LTEBand) can never flip the RAT or clobber the other
   * band masks, then posts the full four-field body the firmware requires.
   */
  private async applyNetMode(patch: (m: NetMode) => NetMode): Promise<GoformSetResult> {
    try {
      const current = parseNetMode(await this.apiGet('/api/net/net-mode'));
      await this.apiPost('/api/net/net-mode', netModeRequest(patch(current)));
      this.invalidate();
      return { result: 'success' };
    } catch (err) {
      return { result: 'failure', error: err instanceof Error ? err.message : String(err) };
    }
  }

  // --- login (Huawei SCRAM) ---------------------------------------------------

  async login(password: string, username = 'admin'): Promise<HiLinkLoginResult> {
    // challenge_login + authentication_login is a two-POST SCRAM handshake that
    // shares one CSRF-token chain. When another client (the router's own web
    // page in a browser tab, a second app instance) is also talking to the box,
    // the shared token space races and the firmware answers 125003. Retry the
    // WHOLE handshake with a fresh session a few times before giving up.
    let lastCode: string | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.loginOnce(password, username);
      } catch (err) {
        if (err instanceof HiLinkApiError) {
          lastCode = err.code;
          if (err.code === '125003' || err.code === '125001' || err.code === '125002') {
            this.csrfToken = null;
            await new Promise((r) => setTimeout(r, 300));
            continue; // token race — fresh handshake
          }
          return { ok: false, code: err.code }; // real failure (wrong pw, lockout)
        }
        throw err;
      }
    }
    return { ok: false, code: lastCode };
  }

  private async loginOnce(password: string, username: string): Promise<HiLinkLoginResult> {
    await this.ensureSession();
    const firstNonce = randomHexNonce();
    const challenge = await this.apiPost('/api/user/challenge_login', {
      username,
      firstnonce: firstNonce,
      mode: 1,
    });
    const serverNonce = challenge.servernonce ?? '';
    const salt = challenge.salt ?? '';
    const iterations = parseInt(challenge.iterations ?? '100', 10);
    if (!serverNonce || !salt) {
      throw new GoformError('HiLink challenge_login returned no salt/nonce', {
        endpoint: '/api/user/challenge_login',
      });
    }
    const proof = scramClientProof(password, firstNonce, serverNonce, salt, iterations);
    // A rejected proof / any failure comes back as <error><code>…</code>, which
    // parseHiLinkXml throws. So a <response> here means the server accepted the
    // login. Success carries `serversignature`; we don't gate on the exact field.
    await this.apiPost('/api/user/authentication_login', {
      clientproof: proof,
      finalnonce: serverNonce,
    });
    this.invalidate();
    return { ok: true, code: undefined };
  }

  // --- snapshot ---------------------------------------------------------------

  private invalidate(): void {
    this.snapshot = null;
  }

  private async commandMap(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.snapshot && now - this.snapshot.at < SNAPSHOT_TTL_MS) return this.snapshot.data;
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchState()
      .then((data) => {
        this.snapshot = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private async fetchState(): Promise<Record<string, string>> {
    const [basic, loginState] = await Promise.all([
      this.tryGet('/api/device/basic_information'),
      this.tryGet('/api/user/state-login'),
    ]);
    if (!basic && !loginState) {
      throw new GoformError('HiLink device did not answer', { endpoint: '/api' });
    }
    const logged = isHiLinkLoggedIn(loginState);

    // Login-only endpoints are skipped while logged out — they would just
    // return 100003 and burn round-trips per poll.
    const [status, traffic, info, signal, plmn, netMode, nbr, sec] = await Promise.all([
      this.tryGet('/api/monitoring/status'),
      this.tryGet('/api/monitoring/traffic-statistics'),
      logged ? this.tryGet('/api/device/information') : Promise.resolve(null),
      logged ? this.tryGet('/api/device/signal') : Promise.resolve(null),
      logged ? this.tryGet('/api/net/current-plmn') : Promise.resolve(null),
      logged ? this.tryGet('/api/net/net-mode') : Promise.resolve(null),
      logged ? this.tryGet('/api/device/nbrcellinfo') : Promise.resolve(null),
      logged ? this.tryGet('/api/device/seccellinfo') : Promise.resolve(null),
    ]);

    const state: HiLinkState = {
      basic, loginState, status, traffic, info, signal, plmn, netMode, nbr, sec,
    };
    return hiLinkToCommands(state);
  }

  private async tryGet(path: string): Promise<Record<string, string> | null> {
    try {
      return await this.apiGet(path);
    } catch {
      return null; // endpoint gated by login / not present on this firmware
    }
  }

  // --- HiLink transport ---------------------------------------------------------

  /**
   * Bootstrap the SessionID cookie. It arrives as an HttpOnly Set-Cookie on
   * the response, which the browser/Electron cookie jar applies automatically.
   *
   * NOTE: the TokInfo in this response is a GLOBAL single-use token — the
   * firmware hands the same value to every client and only the first POST
   * wins (any other client, e.g. the router's own web UI in a browser tab,
   * burns it and we would get 125003). POSTs therefore never use TokInfo;
   * freshToken() fetches a per-session token instead.
   */
  private async ensureSession(): Promise<void> {
    await this.rawFetch('GET', '/api/webserver/SesTokInfo');
  }

  /** Per-session CSRF token: /api/webserver/token, usable part = last 32 chars. */
  private async freshToken(): Promise<string> {
    try {
      const res = await this.rawFetch('GET', '/api/webserver/token');
      const data = parseHiLinkXml(res.text);
      const t = data.token ?? '';
      if (t) return t.length > 32 ? t.slice(t.length - 32) : t;
    } catch {
      /* fall back to the (contended) global token — better than nothing */
    }
    const res = await this.rawFetch('GET', '/api/webserver/SesTokInfo');
    const data = parseHiLinkXml(res.text);
    if (!data.TokInfo) {
      throw new GoformError('Could not obtain HiLink CSRF token', {
        endpoint: '/api/webserver/token',
      });
    }
    return data.TokInfo;
  }

  private async apiGet(path: string, retried = false): Promise<Record<string, string>> {
    const started = performance.now();
    try {
      const res = await this.rawFetch('GET', path);
      const data = parseHiLinkXml(res.text);
      this.traffic('GET', path, {}, started, true, res.status, JSON.stringify(data));
      return data;
    } catch (err) {
      if (err instanceof HiLinkApiError && RETRYABLE_CODES.has(err.code) && !retried) {
        await this.ensureSession();
        return this.apiGet(path, true);
      }
      this.traffic('GET', path, {}, started, false, undefined, undefined, err);
      throw err;
    }
  }

  private async apiPost(
    path: string,
    fields: Record<string, string | number>,
    attempt = 0,
  ): Promise<Record<string, string>> {
    const started = performance.now();
    if (!this.csrfToken) this.csrfToken = await this.freshToken();
    const body = buildHiLinkRequest(fields);
    try {
      const res = await this.rawFetch('POST', path, body, {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        __RequestVerificationToken: this.csrfToken,
      });
      // The firmware rotates the token on every POST and returns the next one
      // (or a #-separated batch after login) in the response header. Chained
      // POSTs (challenge → authentication) MUST use this header token.
      const next = res.headers.get('__RequestVerificationToken');
      if (next) this.csrfToken = next.split('#')[0] ?? null;
      else this.csrfToken = null; // force a fresh token before the next POST

      const data = parseHiLinkXml(res.text);
      this.traffic('POST', path, this.loggable(path, fields), started, true, res.status, res.text);
      return data;
    } catch (err) {
      // Token races are real: other clients (the router's own web UI, a second
      // app instance) share the token space, so retry a couple of times with a
      // fresh session + per-session token.
      if (err instanceof HiLinkApiError && RETRYABLE_CODES.has(err.code) && attempt < 2) {
        this.csrfToken = null;
        await this.ensureSession();
        return this.apiPost(path, fields, attempt + 1);
      }
      this.traffic('POST', path, this.loggable(path, fields), started, false, undefined, undefined, err);
      throw err;
    }
  }

  /** Never leak login proofs into the developer-mode network log. */
  private loggable(path: string, fields: Record<string, string | number>): Record<string, string> {
    if (path.includes('/user/')) return { body: '<redacted>' };
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]));
  }

  private async rawFetch(
    method: 'GET' | 'POST',
    path: string,
    body?: string,
    headers?: Record<string, string>,
  ): Promise<{ status: number; text: string; headers: Headers }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.apiTimeoutMs);
    try {
      const res = await fetch(`${this.apiBase}${path}`, {
        method,
        headers: { 'X-Requested-With': 'XMLHttpRequest', ...(headers ?? {}) },
        body,
        credentials: 'include',
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new GoformError(`HiLink ${method} failed (${res.status})`, {
          endpoint: path,
          status: res.status,
        });
      }
      return { status: res.status, text, headers: res.headers };
    } catch (err) {
      if (err instanceof GoformError || err instanceof HiLinkApiError) throw err;
      throw new GoformError(err instanceof Error ? err.message : 'Network error', {
        endpoint: path,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private traffic(
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, string>,
    started: number,
    ok: boolean,
    status?: number,
    preview?: string,
    err?: unknown,
  ): void {
    if (!this.emitTraffic) return;
    this.emitTraffic({
      id: `hilink-${Date.now()}-${this.trafficSeq++}`,
      timestamp: Date.now(),
      method,
      endpoint,
      label: endpoint.replace('/api/', ''),
      params,
      durationMs: Math.round(performance.now() - started),
      ok,
      status,
      responsePreview: preview?.slice(0, 2000),
      error: err ? (err instanceof Error ? err.message : String(err)) : undefined,
    });
  }
}
