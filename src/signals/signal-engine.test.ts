import { describe, expect, it } from 'vitest';
import { buildSnapshot } from './signal-engine';

describe('buildSnapshot', () => {
  // Values mirror the reference capture in KNOWN_DISCOVERIES.md.
  const raw = {
    network_type: 'ENDC',
    network_provider: 'stc ksa',
    lte_pci: '224',
    nr5g_pci: '206',
    cell_id: '0xB6A2C11',
    lte_rsrp: '-101',
    lte_snr: '4',
    nr5g_rsrp: '-104',
    nr5g_snr: '15',
    nr5g_action_band: 'n78',
    wan_lte_ca: 'ca_activated',
  };

  const snap = buildSnapshot(raw, 1000);

  it('detects ENDC (5G NSA) mode', () => {
    expect(snap.mode).toBe('ENDC');
  });

  it('parses serving-cell identifiers', () => {
    expect(snap.lte.pci).toBe(224);
    expect(snap.nr.pci).toBe(206);
    expect(snap.nr.band).toBe('n78');
  });

  it('derives eNB id from the LTE cell id', () => {
    expect(snap.lte.enbId).toBe(Math.floor(0xb6a2c11 / 256));
  });

  it('classifies signal quality', () => {
    expect(snap.lte.rsrp.quality).toBe('poor'); // -101 dBm (< -100 threshold)
    expect(snap.nr.sinr.quality).toBe('good'); // 15 dB
  });

  it('flags carrier aggregation as active', () => {
    expect(snap.caActive).toBe(true);
  });

  it('marks missing metrics rather than emitting NaN', () => {
    expect(snap.lte.cqi.missing).toBe(true);
    expect(snap.lte.cqi.value).toBeNull();
  });
});
