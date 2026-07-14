import { describe, expect, it } from 'vitest';
import { detectPlugin, resolveRouter } from './registry';
import type { DeviceInfo } from '@/types';

const device = (model: string, hw = ''): DeviceInfo => ({
  model,
  firmware: null,
  hardwareVersion: hw,
  waInnerVersion: null,
  imei: null,
  imsi: null,
  iccid: null,
  msisdn: null,
});

describe('plugin detection', () => {
  it('resolves MC801A1 to the mc801a plugin (most specific)', () => {
    expect(detectPlugin(device('MC801A1')).id).toBe('mc801a');
  });

  it('matches MC888 Pro via prefix', () => {
    expect(detectPlugin(device('MC888 Pro')).id).toBe('mc888');
  });

  it('falls back to generic for unknown models', () => {
    expect(detectPlugin(device('MC9999X')).id).toBe('generic-zte');
  });

  it('matches by hardware version when model is absent', () => {
    expect(detectPlugin(device('', 'MC801A1HW-1.0.0')).id).toBe('mc801a');
  });

  it('resolves an auth strategy for the router', () => {
    expect(resolveRouter(device('MC801A1')).authStrategy.id).toBe('classic-zte');
  });
});
