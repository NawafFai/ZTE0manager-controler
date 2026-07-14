import { useState } from 'react';
import { Card, Spinner, EmptyState } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ConfirmButton';
import { MutationResult } from '@/components/MutationResult';
import { useTowerScan, useLockActions } from '@/hooks';
import { qualityColor, classify } from '@/signals/quality';
import type { NeighborCell } from '@/types';
import { orDash } from '@/utils/format';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';

export function TowerPage() {
  const [auto, setAuto] = useState(false);
  const scan = useTowerScan(true, auto ? 5_000 : false);
  const { lockCell, unlockCell } = useLockActions();
  const [selected, setSelected] = useState<NeighborCell | null>(null);
  const t = useT();

  const cells = scan.data ?? [];
  const canLock = selected?.rat === 'LTE' && selected.pci !== null && selected.earfcnArfcn !== null;

  return (
    <div className="space-y-5">
      <Card
        title={t('tower.title')}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-content-muted">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {t('tower.autorefresh')}
            </label>
            <button className="btn-ghost" onClick={() => scan.refetch()} disabled={scan.isFetching}>
              <Icon name="refresh" /> {t('btn.scan')}
            </button>
          </div>
        }
      >
        {scan.isLoading ? (
          <Spinner label={t('tower.scanning')} />
        ) : cells.length === 0 ? (
          <EmptyState title={t('tower.none')}>{t('tower.noneBody')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-content-muted">
                  <th className="py-2 pr-3">RAT</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">PCI</th>
                  <th className="py-2 pr-3">EARFCN/ARFCN</th>
                  <th className="py-2 pr-3">Band</th>
                  <th className="py-2 pr-3">RSRP</th>
                  <th className="py-2 pr-3">RSRQ</th>
                  <th className="py-2 pr-3">SINR</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {cells.map((cell, i) => {
                  const active = selected === cell;
                  return (
                    <tr
                      key={`${cell.rat}-${cell.pci}-${i}`}
                      onClick={() => setSelected(cell)}
                      className={`cursor-pointer border-t border-border/60 ${
                        active ? 'bg-brand/10' : 'hover:bg-surface-3'
                      }`}
                    >
                      <td className="py-2 pr-3">{cell.rat}</td>
                      <td className="py-2 pr-3">
                        {cell.isServing ? (
                          <span className="chip border-good/50 text-good">{t('tower.serving')}</span>
                        ) : (
                          <span className="text-content-muted">{t('tower.neighbour')}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono">{orDash(cell.pci)}</td>
                      <td className="py-2 pr-3 font-mono">{orDash(cell.earfcnArfcn)}</td>
                      <td className="py-2 pr-3">{orDash(cell.band)}</td>
                      <td className="py-2 pr-3 font-mono" style={{ color: qualityColor(classify('rsrp', cell.rsrp)) }}>
                        {orDash(cell.rsrp)}
                      </td>
                      <td className="py-2 pr-3 font-mono">{orDash(cell.rsrq)}</td>
                      <td className="py-2 pr-3 font-mono" style={{ color: qualityColor(classify('sinr', cell.sinr)) }}>
                        {orDash(cell.sinr)}
                      </td>
                      <td className="py-2 pr-3">{active && '◄'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('tower.lockTitle')}>
        {!selected ? (
          <p className="text-sm text-content-muted">{t('tower.selectFirst')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Selected: <span className="font-mono">{selected.rat}</span> PCI{' '}
              <span className="font-mono">{orDash(selected.pci)}</span> @{' '}
              <span className="font-mono">{orDash(selected.earfcnArfcn)}</span>
            </p>
            {!canLock && (
              <p className="text-xs text-warn">
                Direct cell lock is available for LTE cells with a known PCI + EARFCN.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmButton
                label="Lock to this cell"
                onConfirm={() =>
                  lockCell.mutate({ pci: selected.pci!, earfcn: selected.earfcnArfcn! })
                }
                disabled={!canLock}
                pending={lockCell.isPending}
              />
              <ConfirmButton
                label="Unlock"
                danger
                onConfirm={() => unlockCell.mutate()}
                pending={unlockCell.isPending}
              />
            </div>
            <MutationResult mutation={lockCell} />
            <MutationResult mutation={unlockCell} />
          </div>
        )}
      </Card>
    </div>
  );
}
