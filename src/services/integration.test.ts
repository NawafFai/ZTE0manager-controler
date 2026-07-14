import { afterEach, describe, expect, it } from 'vitest';
import { startMockRouter, MOCK_PASSWORD, type MockRouter } from '@/test/mock-router';
import { GoformClient } from '@/api';
import {
  isSuccess,
  login,
  lockLteCell,
  lockNrBands,
  readDeviceInfo,
  readRadioSnapshot,
  readTelemetry,
  readWan,
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
