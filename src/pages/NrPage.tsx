import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Field, MetricTile, Spinner, EmptyState } from '@/components/ui/primitives';
import { BandSelector } from '@/components/BandSelector';
import { ConfirmButton } from '@/components/ConfirmButton';
import { MutationResult } from '@/components/MutationResult';
import { useRadioSnapshot, useLockActions } from '@/hooks';
import { useConnectionStore, useClient } from '@/store';
import { NR_PRESETS } from '@/signals/band-mask';
import { orDash } from '@/utils/format';

const NR_BANDS = [1, 3, 5, 7, 8, 20, 25, 28, 38, 40, 41, 66, 71, 77, 78, 79];

export function NrPage() {
  const radio = useRadioSnapshot(2_000);
  const caps = useConnectionStore((s) => s.router?.capabilities);
  const client = useClient();
  const { lockNr, lockNrMask, unlockNr } = useLockActions();

  // Diagnostic: read the raw NR mask + supported list so the encoding can be
  // decoded from the real values (needed to make NR band lock actually switch).
  const nrDiag = useQuery({
    queryKey: ['nr-diag'],
    queryFn: () =>
      client!.get({ cmd: ['wan_nr5g_band_lock', 'nr5g_band_lock', 'nr5g_band_list'] }),
    enabled: !!client,
    refetchInterval: 6_000,
  });

  const [bands, setBands] = useState<Set<number>>(new Set([41, 78]));
  const [customMask, setCustomMask] = useState('');

  const snap = radio.data;
  const toggle = (b: number) =>
    setBands((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });

  const previewMask = [...bands].sort((a, b) => a - b).join(',');

  return (
    <div className="space-y-5">
      <Card title="NR diagnostics (screenshot this for band-lock fix)">
        <p className="mb-2 text-xs text-content-muted">
          تشخيص NR — صوّر هذي القيم لي عشان أفك ترميز قفل الباند بدقة · Screenshot these raw values.
        </p>
        <Field label="Current NR mask (wan_nr5g_band_lock)" value={orDash(nrDiag.data?.wan_nr5g_band_lock)} />
        <Field label="NR mask (nr5g_band_lock)" value={orDash(nrDiag.data?.nr5g_band_lock)} />
        <Field label="Supported NR bands (nr5g_band_list)" value={orDash(nrDiag.data?.nr5g_band_list)} />
        <Field label="Serving NR band now" value={orDash(snap?.nr.band)} />
      </Card>

      <Card title="NR (5G) serving cell">
        {!snap ? (
          <Spinner label="Reading NR…" />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Field label="Mode" value={orDash(snap.mode)} />
              <Field label="Band" value={orDash(snap.nr.band)} />
              <Field label="ARFCN" value={orDash(snap.nr.arfcn)} />
              <Field label="PCI" value={orDash(snap.nr.pci)} />
              <Field label="Cell ID" value={orDash(snap.nr.cellId)} />
              <Field label="gNB ID" value={orDash(snap.nr.gnbId)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              <MetricTile label="RSRP" metric={snap.nr.rsrp} />
              <MetricTile label="RSRQ" metric={snap.nr.rsrq} />
              <MetricTile label="SINR" metric={snap.nr.sinr} />
            </div>
          </div>
        )}
      </Card>

      <Card
        title="NR band lock"
        actions={<span className="chip border-good/50 text-good">verified</span>}
      >
        {caps && !caps.nrBandLock ? (
          <EmptyState title="Not supported on this model" />
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-brand/30 bg-brand/10 p-2 text-xs text-content-muted">
              ℹ️ للسرعة القصوى خلّ 5G على الوضع الحر (Auto) — الشبكة تعطيك n78 تلقائيًا. القفل قد
              يفشل إذا كان الباند غير متاح عبر خلية LTE الحالية (وضع NSA). · For max speed keep 5G on
              Auto; locking can fail if the band isn't available via the current LTE anchor.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(NR_PRESETS).map((name) => (
                <button
                  key={name}
                  className="chip cursor-pointer hover:border-brand"
                  onClick={() => setBands(new Set(NR_PRESETS[name]))}
                >
                  {name}
                </button>
              ))}
            </div>

            <BandSelector rat="NR" options={NR_BANDS} selected={bands} onToggle={toggle} />

            <div className="font-mono text-xs text-content-muted">
              nr5g_band_mask: <span className="text-content">{previewMask || '—'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ConfirmButton
                label={`Lock ${bands.size} band${bands.size === 1 ? '' : 's'}`}
                onConfirm={() => lockNr.mutate([...bands])}
                disabled={bands.size === 0}
                pending={lockNr.isPending}
              />
              <ConfirmButton
                label="Unlock (common FR1)"
                danger
                onConfirm={() => unlockNr.mutate()}
                pending={unlockNr.isPending}
              />
            </div>
            <MutationResult mutation={lockNr} hintKey="result.hint.nrBand" />
            <MutationResult mutation={unlockNr} />

            <div className="border-t border-border pt-4">
              <label className="label">Custom band list (e.g. 77,78)</label>
              <div className="flex gap-2">
                <input
                  className="input font-mono"
                  value={customMask}
                  onChange={(e) => setCustomMask(e.target.value)}
                  placeholder="77,78"
                />
                <ConfirmButton
                  label="Apply"
                  onConfirm={() => lockNrMask.mutate(customMask)}
                  disabled={!customMask}
                  pending={lockNrMask.isPending}
                />
              </div>
              <MutationResult mutation={lockNrMask} hintKey="result.hint.nrBand" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
