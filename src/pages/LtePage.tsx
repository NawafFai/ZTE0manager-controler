import { useState } from 'react';
import { Card, Field, MetricTile, Spinner, EmptyState } from '@/components/ui/primitives';
import { BandSelector } from '@/components/BandSelector';
import { ConfirmButton } from '@/components/ConfirmButton';
import { useRadioSnapshot, useLockActions } from '@/hooks';
import { useConnectionStore } from '@/store';
import { download, orDash, pickTextFile } from '@/utils/format';
import { MutationResult } from '@/components/MutationResult';

const LTE_BANDS = [1, 2, 3, 4, 5, 7, 8, 12, 13, 17, 18, 19, 20, 25, 26, 28, 32, 38, 40, 41, 42, 66, 71];

export function LtePage() {
  const radio = useRadioSnapshot(2_000);
  const caps = useConnectionStore((s) => s.router?.capabilities);
  const { lockCell, unlockCell, lockLteBand, unlockLteBand } = useLockActions();

  const [bands, setBands] = useState<Set<number>>(new Set());
  const [pci, setPci] = useState('');
  const [earfcn, setEarfcn] = useState('');

  const snap = radio.data;
  const toggle = (b: number) =>
    setBands((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });

  const exportConfig = () =>
    download(
      'lte-lock-config.json',
      JSON.stringify(
        { bands: [...bands], cellLock: { pci: Number(pci) || null, earfcn: Number(earfcn) || null } },
        null,
        2,
      ),
    );

  const importConfig = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const cfg = JSON.parse(text) as {
        bands?: number[];
        cellLock?: { pci?: number; earfcn?: number };
      };
      if (cfg.bands) setBands(new Set(cfg.bands));
      if (cfg.cellLock?.pci != null) setPci(String(cfg.cellLock.pci));
      if (cfg.cellLock?.earfcn != null) setEarfcn(String(cfg.cellLock.earfcn));
    } catch {
      /* ignore malformed file */
    }
  };

  return (
    <div className="space-y-5">
      <Card title="LTE serving cell">
        {!snap ? (
          <Spinner label="Reading LTE…" />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Field label="Band" value={orDash(snap.lte.band)} />
              <Field label="Bandwidth" value={snap.lte.bandwidthMhz ? `${snap.lte.bandwidthMhz} MHz` : '—'} />
              <Field label="EARFCN" value={orDash(snap.lte.earfcn)} />
              <Field label="PCI" value={orDash(snap.lte.pci)} />
              <Field label="Cell ID" value={orDash(snap.lte.cellId)} />
              <Field label="eNB ID" value={orDash(snap.lte.enbId)} />
              <Field label="TAC" value={orDash(snap.lte.tac)} />
              <Field label="CA" value={snap.caActive ? 'Active' : 'Inactive'} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              <MetricTile label="RSRP" metric={snap.lte.rsrp} />
              <MetricTile label="RSRQ" metric={snap.lte.rsrq} />
              <MetricTile label="SINR" metric={snap.lte.sinr} />
              <MetricTile label="RSSI" metric={snap.lte.rssi} />
              <MetricTile label="CQI" metric={snap.lte.cqi} />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Band lock"
          actions={<span className="chip border-warn/50 text-warn">experimental</span>}
        >
          {caps && !caps.lteBandLock ? (
            <EmptyState title="Not supported on this model" />
          ) : (
            <>
              <p className="mb-3 text-xs text-content-muted">
                Select the LTE bands to allow. Unlock restores a broad default set.
              </p>
              <BandSelector rat="LTE" options={LTE_BANDS} selected={bands} onToggle={toggle} />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ConfirmButton
                  label={`Lock ${bands.size} band${bands.size === 1 ? '' : 's'}`}
                  onConfirm={() => lockLteBand.mutate([...bands])}
                  disabled={bands.size === 0}
                  pending={lockLteBand.isPending}
                />
                <ConfirmButton
                  label="Unlock (all)"
                  danger
                  onConfirm={() => unlockLteBand.mutate()}
                  pending={unlockLteBand.isPending}
                />
              </div>
              <MutationResult mutation={lockLteBand} hintKey="result.hint.lteBand" />
              <MutationResult mutation={unlockLteBand} />
            </>
          )}
        </Card>

        <Card title="Cell lock" actions={<span className="chip border-good/50 text-good">verified</span>}>
          {caps && !caps.lteCellLock ? (
            <EmptyState title="Not supported on this model" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">PCI</label>
                  <input className="input" value={pci} onChange={(e) => setPci(e.target.value)} placeholder="224" />
                </div>
                <div>
                  <label className="label">EARFCN</label>
                  <input
                    className="input"
                    value={earfcn}
                    onChange={(e) => setEarfcn(e.target.value)}
                    placeholder="1650"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ConfirmButton
                  label="Lock cell"
                  onConfirm={() => lockCell.mutate({ pci: Number(pci), earfcn: Number(earfcn) })}
                  disabled={!pci || !earfcn}
                  pending={lockCell.isPending}
                />
                <ConfirmButton
                  label="Unlock cell"
                  danger
                  onConfirm={() => unlockCell.mutate()}
                  pending={unlockCell.isPending}
                />
              </div>
              <MutationResult mutation={lockCell} hintKey="result.hint.cell" />
              <MutationResult mutation={unlockCell} />
            </>
          )}
        </Card>
      </div>

      <Card
        title="Configuration"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportConfig}>
              Export
            </button>
            <button className="btn-ghost" onClick={importConfig}>
              Import
            </button>
          </div>
        }
      >
        <p className="text-sm text-content-muted">
          Export the current band/cell-lock selection to a JSON file, or import a previously saved
          profile. Applying still requires an explicit Lock action.
        </p>
      </Card>
    </div>
  );
}
