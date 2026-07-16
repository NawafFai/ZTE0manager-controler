import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

/**
 * A faithful in-memory emulation of a ZTE router's `goform` API, used to verify
 * the whole app end-to-end without a physical device. It:
 *   - answers GET `goform_get_cmd_process` with the reference values from
 *     KNOWN_DISCOVERIES.md,
 *   - issues fresh `RD` nonces,
 *   - validates the `AD` signature on POSTs exactly as the classic ZTE
 *     algorithm requires (`md5(md5(wa+hw)+rd)`), and
 *   - persists band/cell-lock writes so we can assert they were applied.
 *
 * This is what lets the integration tests prove "pressing Lock sends a
 * correctly-signed request that the router accepts and applies".
 */

const md5 = (s: string): string => createHash('md5').update(s).digest('hex');
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const WA_INNER = 'BD_SASTCEMC801A1V1.0.0B01_INNER';
const HARDWARE = 'MC801A1HW-1.0.0';
const CR_VERSION = 'CR_MC801A1_V1';

/** Password the mock accepts, for login tests. */
export const MOCK_PASSWORD = 'admin1234';

export interface MockRequest {
  goformId: string;
  params: Record<string, string>;
  authOk: boolean;
}

export interface MockRouter {
  url: string;
  port: number;
  received: MockRequest[];
  values: Record<string, string>;
  close: () => Promise<void>;
}

export async function startMockRouter(
  overrides: Record<string, string> = {},
): Promise<MockRouter> {
  let lastRd = '';
  let lastLd = '';
  const received: MockRequest[] = [];

  const values: Record<string, string> = {
    // Reference capture from KNOWN_DISCOVERIES.md
    network_type: 'ENDC',
    network_provider: 'stc ksa',
    rmcc: '420',
    rmnc: '01',
    signalbar: '3',
    cell_id: '0xB6A2C11',
    lte_pci: '224',
    lte_earfcn: '1650',
    lte_band_lock: '0x180080800c5',
    wan_lte_band: 'B3',
    wan_lte_ca: 'ca_activated',
    lte_ca_pcell_band: '3',
    lte_ca_pcell_bandwidth: '20',
    lte_rsrp: '-101',
    lte_rsrq: '-12',
    lte_snr: '4',
    lte_rssi: '-70',
    lte_cqi: '10',
    tac: '1A2B',
    nr5g_pci: '206',
    nr5g_action_band: 'n78',
    nr5g_rsrp: '-104',
    nr5g_rsrq: '-11',
    nr5g_snr: '15',
    nr5g_action_channel: '627264',
    nr5g_cell_id: '0x12345678',
    wan_nr5g_band: 'n78',
    wan_nr5g_band_lock: '',
    wa_inner_version: WA_INNER,
    hardware_version: HARDWARE,
    cr_version: CR_VERSION,
    model_name: 'MC801A1',
    imei: '860000000000000',
    sim_iccid: '8996000000000000000',
    msisdn: '',
    wan_ipaddr: '10.20.30.40',
    ipv6_wan_ipaddr: '2001:db8::1',
    ppp_status: 'ipv4_ipv6_connected',
    sys_uptime: '123456',
    pm_modem_temp: '42',
    ...overrides,
  };

  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://localhost');

    if (u.pathname.endsWith('goform_get_cmd_process')) {
      const cmds = (u.searchParams.get('cmd') ?? '').split(',').filter(Boolean);
      const out: Record<string, string> = {};
      for (const cmd of cmds) {
        if (cmd === 'RD') {
          lastRd = md5(`${Math.random()}-${Date.now()}`).slice(0, 16);
          out.RD = lastRd;
        } else if (cmd === 'LD') {
          lastLd = sha256(`${Math.random()}-${Date.now()}`).toUpperCase();
          out.LD = lastLd;
        } else {
          out[cmd] = values[cmd] ?? '';
        }
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
      return;
    }

    if (u.pathname.endsWith('goform_set_cmd_process')) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const p = new URLSearchParams(body);
        const goformId = p.get('goformId') ?? '';
        const ad = p.get('AD') ?? '';
        const rd = p.get('RD') ?? '';
        const expectedAd = md5(md5(WA_INNER + CR_VERSION) + rd);
        const authOk = ad !== '' && ad === expectedAd && rd === lastRd;

        received.push({ goformId, params: Object.fromEntries(p), authOk });

        // Emulate SHA-256 login: password = SHA256(SHA256(pw) + LD), UPPERCASE hex.
        if (goformId === 'LOGIN') {
          const shaU = (x: string) => sha256(x).toUpperCase();
          const expected = shaU(shaU(MOCK_PASSWORD) + lastLd);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ result: p.get('password') === expected ? '0' : '3' }));
          return;
        }

        // Simulate persistence of the verified lock commands.
        if (authOk && goformId === 'WAN_PERFORM_NR5G_BAND_LOCK') {
          values.wan_nr5g_band_lock = p.get('nr5g_band_mask') ?? '';
        }
        if (authOk && goformId === 'LTE_LOCK_CELL_SET') {
          values.lte_pci = p.get('lte_pci_lock') ?? values.lte_pci ?? '';
          values.lte_earfcn = p.get('lte_earfcn_lock') ?? values.lte_earfcn ?? '';
        }
        // NR cell lock — exists on some models (Easy Control APK), not on the
        // reference MC801A1; emulated here so the experimental path is testable.
        if (authOk && goformId === 'NR5G_LOCK_CELL_SET') {
          values.nr5g_pci_lock = p.get('nr5g_pci_lock') ?? '';
          values.nr5g_freq_lock = p.get('nr5g_freq_lock') ?? '';
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ result: authOk ? 'success' : 'failure' }));
      });
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    received,
    values,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
