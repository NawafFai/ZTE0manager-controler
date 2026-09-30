import { afterEach, describe, expect, it } from 'vitest';
import { startMockRouter, MOCK_PASSWORD, type MockRouter } from '@/test/mock-router';
import { GoformClient } from '@/api';
import {
  isSuccess,
  login,
  lockLteCell,
  lockNrBands,
  lockNrCell,
  readDeviceInfo,
  readRadioSnapshot,
  readTelemetry,
  readWan,
  revertToAuto,
  scanTowers,
} from '@/services';

/**
 * End-to-end tests that run the real GoformClient + services against a
 * simulated ZTE router (src/test/mock-router.ts). This exercises the full
 * stack over actual HTTP — request building, RD/AD signing, response parsing,
 * signal normalization — and proves that lock actions send correctly-signed
 * requests the router accepts and applies.
 */

let router: MockRouter | undefined;
afterEach(async () => {
  await router?.close();
  router = undefined;
});

function last(r: MockRouter) {
  return r.received[r.received.length - 1]!;
}

describe('end-to-end against a simulated ZTE router', () => {
  it('logs in with the SHA-256 password algorithm', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const bad = await login(client, 'wrong-password');
    expect(bad.ok).toBe(false);

    const good = await login(client, MOCK_PASSWORD);
    expect(good.ok).toBe(true);
    expect(good.code).toBe('0');
  });

  it('never hammers a rejected password into the firmware lockout', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const bad = await login(client, 'wrong-password');
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('3');
    // Flag + LD are present → the reject is authoritative: exactly ONE attempt.
    expect(router.received.filter((r) => r.goformId === 'LOGIN')).toHaveLength(1);
  });

  it('logs in on legacy firmware (Base64 password, no RD/LD commands)', async () => {
    router = await startMockRouter({}, { legacy: true });
    const client = new GoformClient({ baseUrl: router.url });

    const good = await login(client, MOCK_PASSWORD);
    expect(good.ok).toBe(true);
    expect(good.code).toBe('0');

    const attempts = router.received.filter((r) => r.goformId === 'LOGIN');
    expect(attempts).toHaveLength(1); // Base64 chosen up front from the absent flag
    // No RD command on this firmware → the post must go out unsigned…
    expect(attempts[0]!.params.AD).toBeUndefined();
    expect(attempts[0]!.params.RD).toBeUndefined();
    // …with the legacy Base64 password encoding.
    expect(attempts[0]!.params.password).toBe(
      Buffer.from(MOCK_PASSWORD, 'utf8').toString('base64'),
    );
  });

  it('legacy wrong password fails with a single attempt (no useless fallback)', async () => {
    router = await startMockRouter({}, { legacy: true });
    const client = new GoformClient({ baseUrl: router.url });

    const bad = await login(client, 'wrong-password');
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('1');
    // No LD salt exists → the SHA-256 fallback is pointless and must be skipped.
    expect(router.received.filter((r) => r.goformId === 'LOGIN')).toHaveLength(1);
  });

  it('detects SHA-256 from the LD salt when the flag is hidden (live-reference behavior)', async () => {
    // The REAL MC801A1 answers WEB_ATTR_IF_SUPPORT_SHA256 = "" before login
    // (verified live) — the LD salt's presence must select SHA-256 directly,
    // in a single attempt, or every login would feed the lockout counter.
    router = await startMockRouter({ WEB_ATTR_IF_SUPPORT_SHA256: '' });
    const client = new GoformClient({ baseUrl: router.url });

    const good = await login(client, MOCK_PASSWORD);
    expect(good.ok).toBe(true);
    expect(good.code).toBe('0');
    expect(router.received.filter((r) => r.goformId === 'LOGIN')).toHaveLength(1);
  });

  it('spends at most ONE Base64 fallback per session when the scheme is heuristic', async () => {
    // Contrived firmware: serves an LD-like salt (→ SHA-256 chosen
    // heuristically) but actually wants the legacy Base64 password.
    router = await startMockRouter({ LD: 'STATICSALT' }, { legacy: true });
    const client = new GoformClient({ baseUrl: router.url });

    const good = await login(client, MOCK_PASSWORD);
    expect(good.ok).toBe(true); // rescued by the single Base64 fallback
    expect(router.received.filter((r) => r.goformId === 'LOGIN')).toHaveLength(2);

    // The working scheme is remembered — the next login is a single attempt.
    const again = await login(client, MOCK_PASSWORD);
    expect(again.ok).toBe(true);
    expect(router.received.filter((r) => r.goformId === 'LOGIN')).toHaveLength(3);
  });

  it('reads device identity', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });
    const device = await readDeviceInfo(client);
    expect(device.model).toBe('MC801A1');
    expect(device.hardwareVersion).toBe('MC801A1HW-1.0.0');
    expect(device.imei).toBe('860000000000000');
  });

  it('reads and normalizes a radio snapshot', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });
    const snap = await readRadioSnapshot(client);
    expect(snap.mode).toBe('ENDC');
    expect(snap.lte.pci).toBe(224);
    expect(snap.lte.rsrp.value).toBe(-101);
    expect(snap.nr.band).toBe('n78');
    expect(snap.nr.sinr.value).toBe(15);
    expect(snap.caActive).toBe(true);
  });

  it('reads WAN + telemetry', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });
    expect((await readWan(client)).ipv4).toBe('10.20.30.40');
    expect((await readTelemetry(client)).temperatureC).toBe(42);
  });

  it('applies an NR band lock with a correctly-signed request', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const res = await lockNrBands(client, [78]);
    expect(isSuccess(res)).toBe(true);

    const req = last(router);
    expect(req.goformId).toBe('WAN_PERFORM_NR5G_BAND_LOCK');
    // NR uses a comma-separated band list, not a hex bitmask.
    expect(req.params.nr5g_band_mask).toBe('78');
    expect(req.authOk).toBe(true); // RD/AD signature verified by the router

    // The router persisted the lock → reading it back reflects the change.
    expect(await client.getValue('wan_nr5g_band_lock')).toBe('78');
  });

  it('applies an LTE cell lock (verified goformId + params)', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const res = await lockLteCell(client, { pci: 224, earfcn: 1650 });
    expect(isSuccess(res)).toBe(true);

    const req = last(router);
    expect(req.goformId).toBe('LTE_LOCK_CELL_SET');
    expect(req.params.lte_pci_lock).toBe('224');
    expect(req.params.lte_earfcn_lock).toBe('1650');
    expect(req.authOk).toBe(true);
  });

  it('applies an NR cell lock (experimental NR5G_LOCK_CELL_SET path)', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const res = await lockNrCell(client, { pci: 206, arfcn: 627264 });
    expect(isSuccess(res)).toBe(true);

    const req = last(router);
    expect(req.goformId).toBe('NR5G_LOCK_CELL_SET');
    expect(req.params.nr5g_pci_lock).toBe('206');
    expect(req.params.nr5g_freq_lock).toBe('627264');
    expect(req.authOk).toBe(true);

    // The router persisted the lock → reading it back reflects the change.
    expect(await client.getValue('nr5g_pci_lock')).toBe('206');
  });

  it('revert flow: cell unlocks + LTE band auto + NR list + bearer auto', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    await revertToAuto(client);

    const ids = router.received.map((r) => r.goformId);
    expect(ids).toEqual([
      'LTE_LOCK_CELL_SET', // clear LTE cell lock
      'NR5G_LOCK_CELL_SET', // clear NR cell lock (best-effort, no retry)
      'BAND_SELECT', // LTE bands back to auto
      'WAN_PERFORM_NR5G_BAND_LOCK', // NR widened to the full band list
      'SET_BEARER_PREFERENCE', // RAT preference back to auto
    ]);
    expect(router.received.every((r) => r.authOk)).toBe(true);

    const [lteCell, nrCell, bandSelect, nrBands, bearer] = router.received;
    expect(lteCell!.params.lte_pci_lock).toBe('0');
    expect(lteCell!.params.lte_earfcn_lock).toBe('0');
    expect(nrCell!.params.nr5g_pci_lock).toBe('0');
    // Auto = flag ON + the all-bands mask. is_lte_band=0 / mask 0x0 left the modem
    // with an empty band mask (no internet).
    expect(bandSelect!.params.is_lte_band).toBe('1');
    expect(bandSelect!.params.lte_band_mask).toBe('0xa3e2ab0908df');
    // NR "auto" = a wide comma-separated band-NUMBER list (never a hex mask).
    const nrList = (nrBands!.params.nr5g_band_mask ?? '').split(',').map(Number);
    expect(nrList.length).toBeGreaterThan(5);
    expect(nrList).toContain(78);
    expect(nrBands!.params.nr5g_band_mask).not.toMatch(/^0x/i);
    // Only values from the router's real option list may ever be sent.
    expect(['4G_AND_5G', 'WL_AND_5G', 'LTE_AND_5G']).toContain(bearer!.params.BearerPreference);
  });

  it('rejects an unsigned mutating request (auth is really enforced)', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });

    const res = await client.set({
      goformId: 'WAN_PERFORM_NR5G_BAND_LOCK',
      params: { nr5g_band_mask: '0x1' },
      authenticated: false, // no RD/AD attached
    });
    expect(isSuccess(res)).toBe(false);
    expect(last(router).authOk).toBe(false);
  });

  it('synthesizes serving cells for the tower scanner', async () => {
    router = await startMockRouter();
    const client = new GoformClient({ baseUrl: router.url });
    const snap = await readRadioSnapshot(client);
    const cells = await scanTowers(client, snap);
    const serving = cells.filter((c) => c.isServing);
    expect(serving.length).toBeGreaterThanOrEqual(1);
    expect(serving.some((c) => c.pci === 224 || c.pci === 206)).toBe(true);
  });
});
