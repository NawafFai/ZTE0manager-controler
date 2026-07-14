import { describe, expect, it } from 'vitest';
import { bandsFromMask, maskFromBands, maskToHex, parseMask } from './band-mask';

describe('band-mask', () => {
  it('maps NR band n78 to bit 77', () => {
    const mask = maskFromBands([78]);
    expect(mask).toBe(1n << 77n);
    expect(bandsFromMask(mask)).toEqual([78]);
  });

  it('round-trips a multi-band set', () => {
    const bands = [1, 3, 41, 78];
    expect(bandsFromMask(maskFromBands(bands)).sort((a, b) => a - b)).toEqual(bands);
  });

  it('parses hex and decimal masks', () => {
    expect(parseMask('0x5')).toBe(5n);
    expect(parseMask('5')).toBe(5n);
    expect(maskToHex(5n)).toBe('0x5');
  });

  it('decodes the documented LTE lock mask (0x180080800c5)', () => {
    const bands = bandsFromMask(parseMask('0x180080800c5'));
    expect(bands).toContain(1);
    expect(bands).toContain(3);
  });
});
