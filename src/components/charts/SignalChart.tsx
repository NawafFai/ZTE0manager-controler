import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import { ensureChartsRegistered } from './chart-setup';
import type { SignalSample } from '@/hooks';

ensureChartsRegistered();

export interface SeriesDef {
  label: string;
  pick: (s: SignalSample) => number | null;
  color: string;
}

/**
 * Generic time-series line chart for the live monitor. Series are described
 * declaratively so signal / bandwidth / latency graphs all reuse this one
 * component with different pickers.
 */
export function SignalChart({
  samples,
  series,
  yTitle,
  height = 220,
  suggestedMin,
  suggestedMax,
}: {
  samples: SignalSample[];
  series: SeriesDef[];
  yTitle: string;
  height?: number;
  suggestedMin?: number;
  suggestedMax?: number;
}) {
  const data: ChartData<'line'> = useMemo(
    () => ({
      labels: samples.map((s) => new Date(s.t).toLocaleTimeString()),
      datasets: series.map((def) => ({
        label: def.label,
        data: samples.map((s) => def.pick(s)),
        borderColor: def.color,
        backgroundColor: def.color + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        spanGaps: true,
        fill: true,
      })),
    }),
    [samples, series],
  );

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: 'rgb(148 163 184)', boxWidth: 12 } },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { color: 'rgb(148 163 184)', maxTicksLimit: 6 },
          grid: { color: 'rgba(148,163,184,0.1)' },
        },
        y: {
          ...(suggestedMin !== undefined ? { suggestedMin } : {}),
          ...(suggestedMax !== undefined ? { suggestedMax } : {}),
          title: { display: true, text: yTitle, color: 'rgb(148 163 184)' },
          ticks: { color: 'rgb(148 163 184)' },
          grid: { color: 'rgba(148,163,184,0.1)' },
        },
      },
    }),
    [yTitle, suggestedMin, suggestedMax],
  );

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
