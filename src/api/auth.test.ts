import { describe, expect, it } from 'vitest';
import { classicZteAuth, swappedZteAuth } from './auth';
import { md5 } from './crypto';

describe('auth', () => {
  const inputs = { rd: 'abc123', waInnerVersion: 'BD_V1', crVersion: 'CR_V1' };

  it('classic AD = md5(md5(wa_inner_version + cr_version) + rd)', () => {
    const expected = md5(md5('BD_V1CR_V1') + 'abc123');
    expect(classicZteAuth.computeAd(inputs)).toBe(expected);
  });

  it('swapped strategy differs from classic', () => {
    expect(swappedZteAuth.computeAd(inputs)).not.toBe(classicZteAuth.computeAd(inputs));
  });

  it('is deterministic for the same inputs', () => {
    expect(classicZteAuth.computeAd(inputs)).toBe(classicZteAuth.computeAd(inputs));
  });
});
