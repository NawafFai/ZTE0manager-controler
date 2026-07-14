import type { Metric, SignalQuality } from '@/types';

/**
 * Standard cellular quality thresholds. Each entry is ordered best→worst; the
 * first threshold a value meets or exceeds wins. Keeping them declarative makes
 * the colouring in the UI derive from one source of truth.
 */
type Threshold = { quality: SignalQuality; min: number };

const THRESHOLDS: Record<string, Threshold[]> = {
  rsrp: [
    { quality: 'excellent', min: -80 },
    { quality: 'good', min: -90 },
    { quality: 'fair', min: -100 },
    { quality: 'poor', min: -Infinity },
  ],
  rsrq: [
    { quality: 'excellent', min: -10 },
    { quality: 'good', min: -15 },
    { quality: 'fair', min: -20 },
    { quality: 'poor', min: -Infinity },
  ],
  sinr: [
    { quality: 'excellent', min: 20 },
    { quality: 'good', min: 13 },
    { quality: 'fair', min: 0 },
    { quality: 'poor', min: -Infinity },
  ],
  rssi: [
    { quality: 'excellent', min: -65 },
    { quality: 'good', min: -75 },
    { quality: 'fair', min: -85 },
    { quality: 'poor', min: -Infinity },
  ],
  cqi: [
    { quality: 'excellent', min: 13 },
    { quality: 'good', min: 10 },
    { quality: 'fair', min: 7 },
    { quality: 'poor', min: -Infinity },
  ],
};

const UNITS: Record<string, string> = {
  rsrp: 'dBm',
  rsrq: 'dB',
  sinr: 'dB',
  rssi: 'dBm',
  cqi: '',
};

export type MetricKind = keyof typeof THRESHOLDS;

export function classify(kind: MetricKind, value: number | null): SignalQuality {
  if (value === null || Number.isNaN(value)) return 'none';
  const table = THRESHOLDS[kind];
  if (!table) return 'none';
  for (const t of table) {
    if (value >= t.min) return t.quality;
  }
  return 'poor';
}

/** Build a fully-classified metric from a possibly-missing raw value. */
export function metric(kind: MetricKind, value: number | null): Metric {
  const missing = value === null || Number.isNaN(value);
  return {
    value: missing ? null : value,
    unit: UNITS[kind] ?? '',
    quality: classify(kind, value),
    missing,
  };
}

const QUALITY_COLORS: Record<SignalQuality, string> = {
  excellent: 'var(--good)',
  good: 'var(--good)',
  fair: 'var(--warn)',
  poor: 'var(--bad)',
  none: 'var(--content-muted)',
};

export function qualityColor(q: SignalQuality): string {
  return `rgb(${QUALITY_COLORS[q]})`;
}
