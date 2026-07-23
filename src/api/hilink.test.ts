import { describe, expect, it } from 'vitest';
import { HiLinkApiError, buildHiLinkRequest, parseHiLinkXml } from './hilink-xml';
import { scramClientProof, randomHexNonce } from './hilink-crypto';
import { hiLinkToCommands, isHiLinkLoggedIn } from './hilink-map';
import { buildSnapshot } from '@/signals/signal-engine';

describe('parseHiLinkXml', () => {
  it('parses a flat response document', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><response><devicename>H155-383</devicename>' +
      '<spreadname_en>5G CPE 5</spreadname_en><message/></response>';
    expect(parseHiLinkXml(xml)).toEqual({
      devicename: 'H155-383',
      spreadname_en: '5G CPE 5',
      message: '',
    });
  });

  it('decodes XML entities', () => {
    const xml = '<response><FullName>A &amp; B &lt;5G&gt;</FullName></response>';
    expect(parseHiLinkXml(xml).FullName).toBe('A & B <5G>');
  });

  it('decodes numeric character references (CSRF tokens contain / and +)', () => {
    const xml = '<response><TokInfo>t5mTP6&#x2F;m&#x2F;Ts3JB1Lt&#43;wIe</TokInfo></response>';
    expect(parseHiLinkXml(xml).TokInfo).toBe('t5mTP6/m/Ts3JB1Lt+wIe');
  });

  it('throws HiLinkApiError with the firmware error code', () => {
    const xml = '<?xml version="1.0"?><error><code>108006</code><message/></error>';
    expect(() => parseHiLinkXml(xml)).toThrowError(HiLinkApiError);
    try {
      parseHiLinkXml(xml);
    } catch (err) {
      expect((err as HiLinkApiError).code).toBe('108006');
    }
  });

  it('rejects non-XML bodies', () => {
    expect(() => parseHiLinkXml('{"result":"0"}')).toThrow();
  });
});

describe('buildHiLinkRequest', () => {
  it('builds and escapes a request document', () => {
    expect(buildHiLinkRequest({ username: 'admin', mode: 1 })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><request><username>admin</username><mode>1</mode></request>',
    );
    expect(buildHiLinkRequest({ v: 'a<b&c' })).toContain('<v>a&lt;b&amp;c</v>');
  });
});

describe('scram', () => {
  it('produces a deterministic 64-hex-char proof', () => {
    const proof = scramClientProof('secret', 'a'.repeat(64), 'b'.repeat(96), 'c0ffee', 100);
    expect(proof).toMatch(/^[0-9a-f]{64}$/);
    expect(scramClientProof('secret', 'a'.repeat(64), 'b'.repeat(96), 'c0ffee', 100)).toBe(proof);
  });

  it('changes the proof when the password changes', () => {
    const a = scramClientProof('secret', 'a'.repeat(64), 'b'.repeat(96), 'c0ffee', 100);
    const b = scramClientProof('wrong', 'a'.repeat(64), 'b'.repeat(96), 'c0ffee', 100);
    expect(a).not.toBe(b);
  });

  it('generates 64-char hex nonces', () => {
    expect(randomHexNonce()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the router firmware (emui-crypto.js) golden vector', () => {
    // Reference value produced by running the device's OWN CryptoJS.SCRAM
    // .clientProof() over this exact vector (see crypto cross-check). Pins the
    // non-standard HMAC arg order so an accidental swap regresses loudly.
    const proof = scramClientProof(
      'Test@1234',
      'a'.repeat(64),
      'b'.repeat(96),
      'ebd3413f32f86f29fb199db8e35192a85f05e01f9becef77939472ef432715f8',
      1000,
    );
    expect(proof).toBe('316f1a690d7436e32ce83d5fa1f007a12f0ebf3e869df5e65eabf80e7afcca35');
  });
});

describe('hiLinkToCommands', () => {
  const state = {
    basic: { devicename: 'H155-383', spreadname_en: '5G CPE 5' },
    loginState: { State: '0', Username: 'admin' },
    status: {
      ConnectionStatus: '901',
      SignalIcon: '4',
      CurrentNetworkType: '19',
      WanIPAddress: '10.20.30.40',
    },
    traffic: { CurrentConnectTime: '3600' },
    info: {
      SoftwareVersion: '3.0.2.101',
      WebUIVersion: 'WEBUI 3.0',
      Imei: '860000000000000',
      workmode: 'NSA',
    },
    signal: {
      rsrp: '-84dBm',
      rsrq: '-9dB',
      sinr: '17dB',
      pci: '123',
      cell_id: '10485761',
      earfcn: '1300',
      band: '3',
      dlbandwidth: '20MHz',
      nrrsrp: '-88dBm',
      nrsinr: '21dB',
      nrband: 'n78',
      nrpci: '456',
    },
    plmn: { FullName: 'TestNet', Numeric: '42001' },
  };

  it('detects the login state', () => {
    expect(isHiLinkLoggedIn({ State: '0' })).toBe(true);
    expect(isHiLinkLoggedIn({ State: '-1' })).toBe(false);
    expect(isHiLinkLoggedIn(null)).toBe(false);
  });

  it('maps identity and session fields to ZTE command names', () => {
    const cmds = hiLinkToCommands(state);
    expect(cmds.model_name).toBe('5G CPE 5');
    expect(cmds.hardware_version).toBe('H155-383');
    expect(cmds.wa_inner_version).toBe('3.0.2.101');
    expect(cmds.cr_version).toBe('WEBUI 3.0'); // present only when logged in
    expect(cmds.ppp_status).toBe('ppp_connected');
    expect(cmds.rmcc).toBe('420');
    expect(cmds.rmnc).toBe('01');
  });

  it('hides cr_version when logged out', () => {
    const cmds = hiLinkToCommands({ ...state, loginState: { State: '-1' }, info: null });
    expect(cmds.cr_version).toBeUndefined();
  });

  it('derives 5G-NSA + CA from a real STC H155 monitoring/status snapshot', () => {
    // Captured live from the device (carrier-locks /api/device/signal, so only
    // monitoring/status is available). EndcStatus=1 ⇒ 5G NSA + CA active.
    const cmds = hiLinkToCommands({
      basic: { spreadname_en: '5G CPE 5', devicename: 'H155-383' },
      loginState: { State: '0' },
      status: {
        ConnectionStatus: '901',
        SignalIcon: '5',
        maxsignal: '5',
        CurrentNetworkType: '19',
        CurrentNetworkTypeEx: '101',
        EndcStatus: '1',
      },
      traffic: { CurrentConnectTime: '138849' },
      info: { SoftwareVersion: '1.0', Imei: '860000000000000' },
      signal: null, // carrier-locked
      plmn: { FullName: 'STC', Numeric: '42001' },
    });
    expect(cmds.signalbar).toBe('5');
    expect(cmds.wan_lte_ca).toBe('1');
    expect(cmds.network_provider).toBe('STC');
    const snap = buildSnapshot(cmds);
    expect(snap.mode).toBe('ENDC'); // shows as 5G
    expect(snap.caActive).toBe(true);
    expect(snap.signalBars).toBe(5);
    expect(snap.operator).toBe('STC');
  });

  it('strips units so the signal engine parses real numbers', () => {
    const snapshot = buildSnapshot(hiLinkToCommands(state));
    expect(snapshot.mode).toBe('NR_NSA'); // workmode NSA
    expect(snapshot.lte.rsrp.value).toBe(-84);
    expect(snapshot.lte.sinr.value).toBe(17);
    expect(snapshot.lte.band).toBe('3');
    expect(snapshot.lte.bandwidthMhz).toBe(20);
    expect(snapshot.nr.rsrp.value).toBe(-88);
    expect(snapshot.nr.band).toBe('n78');
    expect(snapshot.nr.pci).toBe(456);
    expect(snapshot.signalBars).toBe(4);
    expect(snapshot.operator).toBe('TestNet');
  });
});
