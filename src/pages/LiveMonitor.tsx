import { useState } from 'react';
import { Card, MetricTile, Spinner } from '@/components/ui/primitives';
import { SignalChart } from '@/components/charts/SignalChart';
import { useRadioSnapshot, useSignalHistory } from '@/hooks';
import { Icon } from '@/components/ui/Icon';
import { download, toCsv } from '@/utils/format';
import { useT } from '@/i18n';

const INTERVALS = [1_000, 2_000, 5_000];

export function LiveMonitor() {
  const [interval, setInterval] = useState(1_000);
  const [paused, setPaused] = useState(false);
  const radio = useRadioSnapshot(paused ? false : interval);
  const { samples, reset } = useSignalHistory(radio.data);
  const snap = radio.data;
  const t = useT();

  return (
    <div className="space-y-5">
      <Card
        title={t('live.title')}
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input w-auto py-1"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            >
              {INTERVALS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000}s
                </option>
              ))}
            </select>
            <button className="btn-ghost" onClick={() => setPaused((p) => !p)}>
              {paused ? t('btn.resume') : t('btn.pause')}
            </button>
            <button
              className="btn-ghost"
              disabled={samples.length === 0}
              onClick={() =>
                download(
                  `zte-signal-log-${Date.now()}.csv`,
                  toCsv(
                    ['time', 'lte_rsrp', 'lte_sinr', 'nr_rsrp', 'nr_sinr'],
                    samples.map((s) => [
                      new Date(s.t).toISOString(),
                      s.lteRsrp,
                      s.lteSinr,
                      s.nrRsrp,
                      s.nrSinr,
                    ]),
                  ),
                  'text/csv',
                )
              }
            >
              {t('live.exportCsv')}
            </button>
            <button className="btn-ghost" onClick={reset}>
              <Icon name="refresh" /> {t('btn.clear')}
            </button>
          </div>
        }
      >
        {!snap ? (
          <Spinner label={t('live.waiting')} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <MetricTile label="LTE RSRP" metric={snap.lte.rsrp} />
            <MetricTile label="LTE SINR" metric={snap.lte.sinr} />
            <MetricTile label="LTE RSRQ" metric={snap.lte.rsrq} />
            <MetricTile label="NR RSRP" metric={snap.nr.rsrp} />
            <MetricTile label="NR SINR" metric={snap.nr.sinr} />
            <MetricTile label="NR RSRQ" metric={snap.nr.rsrq} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t('live.rsrp')}>
          <SignalChart
            samples={samples}
            yTitle="dBm"
            suggestedMin={-120}
            suggestedMax={-60}
            series={[
              { label: 'LTE RSRP', pick: (s) => s.lteRsrp, color: '#38bdf8' },
              { label: 'NR RSRP', pick: (s) => s.nrRsrp, color: '#a78bfa' },
            ]}
          />
        </Card>
        <Card title={t('live.sinr')}>
          <SignalChart
            samples={samples}
            yTitle="dB"
            suggestedMin={-5}
            suggestedMax={30}
            series={[
              { label: 'LTE SINR', pick: (s) => s.lteSinr, color: '#22c55e' },
              { label: 'NR SINR', pick: (s) => s.nrSinr, color: '#eab308' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
