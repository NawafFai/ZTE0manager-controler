import { describe, expect, it } from 'vitest';
import {
  huaweiLteBandToZte,
  huaweiNrBandToList,
  neighborBlobs,
  netModeRequest,
  networkModeLabel,
  nrListToHuaweiMask,
  parseNetMode,
  LTE_BAND_ALL,
} from './hilink-net';
import { hiLinkToCommands } from './hilink-map';

describe('net-mode parse/build', () => {
  it('parses a net-mode response case-insensitively', () => {
    const m = parseNetMode({ NetworkMode: '03', NetworkBand: '3FFFFFFF', LTEBand: '80000', NRBand: '' });
    expect(m.networkMode).toBe('03');
    expect(m.lteBand).toBe('80000');
  });

  it('defaults missing fields to allow-all', () => {
    const m = parseNetMode(null);
    expect(m.networkMode).toBe('00');
    expect(m.lteBand).toBe(LTE_BAND_ALL);
  });

  it('builds a four-field request and omits empty NRBand', () => {
    const body = netModeRequest({ networkMode: '00', networkBand: '3fffffff', lteBand: '0x80000', nrBand: '' });
    expect(body).toEqual({ NetworkMode: '00', NetworkBand: '3FFFFFFF', LTEBand: '80000' });
    expect('NRBand' in body).toBe(false);
  });

  it('includes NRBand when present', () => {
    const body = netModeRequest({ networkMode: '00', networkBand: '3FFFFFFF', lteBand: '1', nrBand: '2000000000000000000000' });
    expect(body.NRBand).toBe('2000000000000000000000');
  });
});

describe('band mask conversions', () => {
  it('LTE mask passes through (bit N-1 shared convention), normalised', () => {
    expect(huaweiLteBandToZte('80000')).toBe('0x80000'); // B20
  });

  it('NR list ⇄ Huawei hex bitmask round-trips', () => {
    const mask = nrListToHuaweiMask('77,78'); // bits 76,77
    expect(huaweiNrBandToList(mask)).toBe('77,78');
  });

  it('tolerates "n"-prefixed NR labels', () => {
    expect(nrListToHuaweiMask('n78, n41')).toBe(nrListToHuaweiMask('41,78'));
  });
});

describe('networkModeLabel', () => {
  it('maps RAT codes to labels', () => {
    expect(networkModeLabel('00')).toBe('AUTO');
    expect(networkModeLabel('03')).toBe('LTE');
    expect(networkModeLabel('99')).toBe('99');
  });
});

describe('neighbour blobs', () => {
  it('builds ";"-blobs from numbered neighbour fields', () => {
    const blob = neighborBlobs(
      { Pci0: '100', Earfcn0: '1300', Rsrp0: '-90', Pci1: '200', Earfcn1: '1500', Rsrp1: '-95' },
      null,
    );
    expect(blob.lte).toBe('100,1300,,-90,,;200,1500,,-95,,');
  });

  it('is empty for an unrecognised shape', () => {
    expect(neighborBlobs({ Foo: 'bar' }, null).lte).toBe('');
  });
});

describe('hiLinkToCommands net-mode integration', () => {
  it('maps net-mode + neighbours into ZTE command keys', () => {
    const cmds = hiLinkToCommands({
      basic: { spreadname_en: '5G CPE 5' },
      loginState: { State: '0' },
      status: null,
      traffic: null,
      info: { SoftwareVersion: '1.0' },
      signal: { rsrp: '-80dBm' },
      plmn: null,
      netMode: { NetworkMode: '00', LTEBand: '80000', NRBand: nrListToHuaweiMask('78') },
      nbr: { Pci0: '55', Earfcn0: '1300', Rsrp0: '-88' },
      sec: { Pci: '77', Earfcn: '500000', Rsrp: '-92' },
    });
    expect(cmds.lte_band_lock).toBe('0x80000');
    expect(cmds.wan_nr5g_band_lock).toBe('78');
    expect(cmds.current_network_mode).toBe('AUTO');
    expect(cmds.lte_neighbor_cell).toContain('55,1300,,-88');
    expect(cmds.wan_lte_ca).toBe('1');
  });
});
