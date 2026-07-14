import type { ReactNode } from 'react';
import type { Metric, SignalQuality } from '@/types';
import { qualityColor } from '@/signals/quality';

/** Small, dependency-free presentational primitives shared across pages. */

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-content">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="label">{label}</div>
      <div className="text-lg font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-content-muted">{hint}</div>}
    </div>
  );
}

export function MetricTile({ label, metric }: { label: string; metric: Metric }) {
  const value = metric.missing ? '—' : `${metric.value}`;
  return (
    <StatTile
      label={label}
      value={
        <span>
          {value}
          {!metric.missing && metric.unit && (
            <span className="ml-1 text-xs text-content-muted">{metric.unit}</span>
          )}
        </span>
      }
      accent={metric.missing ? undefined : qualityColor(metric.quality)}
    />
  );
}

const QUALITY_LABEL: Record<SignalQuality, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  none: 'No data',
};

export function QualityBadge({ quality }: { quality: SignalQuality }) {
  return (
    <span
      className="chip"
      style={{ borderColor: qualityColor(quality), color: qualityColor(quality) }}
    >
      {QUALITY_LABEL[quality]}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-content-muted">{label}</span>
      <span className="text-right font-mono text-sm text-content">{value ?? '—'}</span>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-content-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-brand" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-content">{title}</p>
      {children && <p className="mt-1 text-sm text-content-muted">{children}</p>}
    </div>
  );
}
