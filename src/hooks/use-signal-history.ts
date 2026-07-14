import { useEffect, useRef, useState } from 'react';
import type { RadioSnapshot } from '@/types';

/** One retained sample of the metrics the live monitor graphs. */
export interface SignalSample {
  t: number;
  lteRsrp: number | null;
  lteSinr: number | null;
  nrRsrp: number | null;
  nrSinr: number | null;
}

/**
 * Accumulates a bounded time-series from successive radio snapshots for the
 * live-monitor charts. Kept out of the query cache so charts retain history
 * across refetches without re-plotting on every render.
 */
export function useSignalHistory(snapshot: RadioSnapshot | undefined, maxSamples = 120) {
  const [samples, setSamples] = useState<SignalSample[]>([]);
  const lastTs = useRef<number>(0);

  useEffect(() => {
    if (!snapshot || snapshot.timestamp === lastTs.current) return;
    lastTs.current = snapshot.timestamp;
    setSamples((prev) => {
      const next = [
        ...prev,
        {
          t: snapshot.timestamp,
          lteRsrp: snapshot.lte.rsrp.value,
          lteSinr: snapshot.lte.sinr.value,
          nrRsrp: snapshot.nr.rsrp.value,
          nrSinr: snapshot.nr.sinr.value,
        },
      ];
      if (next.length > maxSamples) next.splice(0, next.length - maxSamples);
      return next;
    });
  }, [snapshot, maxSamples]);

  const reset = () => setSamples([]);
  return { samples, reset };
}
