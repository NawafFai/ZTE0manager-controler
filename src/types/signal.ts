/** Normalized radio / network domain model shared across the UI. */

export type ConnectionMode = 'NO_SERVICE' | 'LTE' | 'NR_NSA' | 'NR_SA' | 'ENDC' | 'UNKNOWN';

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

/** A single measurable radio metric with quality classification. */
export interface Metric {
  value: number | null;
  unit: string;
  quality: SignalQuality;
  /** True when the underlying command returned nothing / an invalid value. */
  missing: boolean;
}

/** LTE serving-cell measurements. */
export interface LteMetrics {
  rsrp: Metric;
  rsrq: Metric;
  sinr: Metric;
  rssi: Metric;
  cqi: Metric;
  band: string | null;
  bandwidthMhz: number | null;
  earfcn: number | null;
  pci: number | null;
  cellId: string | null;
  enbId: number | null;
  tac: string | null;
}

/** NR (5G) serving-cell measurements. */
export interface NrMetrics {
  rsrp: Metric;
  rsrq: Metric;
  sinr: Metric;
  band: string | null;
  bandwidthMhz: number | null;
  arfcn: number | null;
  pci: number | null;
  cellId: string | null;
  gnbId: number | null;
}

/** One component carrier in a carrier-aggregation set. */
export interface CarrierComponent {
  type: 'LTE' | 'NR';
  role: 'PCC' | 'SCC';
  band: string | null;
  earfcnArfcn: number | null;
  bandwidthMhz: number | null;
  pci: number | null;
}

/** A neighbour / detected cell (for the tower scanner). */
export interface NeighborCell {
  rat: 'LTE' | 'NR';
  pci: number | null;
  earfcnArfcn: number | null;
  band: string | null;
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  isServing: boolean;
}

/** Aggregated real-time picture used by the dashboard and live monitor. */
export interface RadioSnapshot {
  timestamp: number;
  mode: ConnectionMode;
  operator: string | null;
  mcc: string | null;
  mnc: string | null;
  signalBars: number | null;
  lte: LteMetrics;
  nr: NrMetrics;
  carriers: CarrierComponent[];
  caActive: boolean;
}
