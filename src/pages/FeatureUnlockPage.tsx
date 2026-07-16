import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Card, EmptyState, Spinner } from '@/components/ui/primitives';
import { BandSelector } from '@/components/BandSelector';
import { ConfirmButton } from '@/components/ConfirmButton';
import { MutationResult } from '@/components/MutationResult';
import { Icon } from '@/components/ui/Icon';
import { useApiDatabase, useRunDiscovery, useLockActions, useRecovery } from '@/hooks';
import { resolveUnlockableFeatures, type ResolvedUnlockFeature } from '@/services';
import { NR_PRESETS } from '@/signals/band-mask';
import { useT } from '@/i18n';
import type { ApiConfidence } from '@/types';

/**
 * Feature Unlock — surfaces the band/cell lock controls the stock ISP web UI
 * hides. Discovery-based, never hardcoded: on first visit the page runs the
 * reverse-engineering engine (crawl the router's JS → parse goformIds) and a
 * control renders only when its command exists in the resulting database.
 * Genuinely unsupported features show "unavailable on this model" instead of a
 * dead button.
 *
 * The static plugin capabilities used by the LTE/NR pages are a per-family
 * baseline; here availability comes from the live-discovered DB, which is
 * stronger per-device evidence. All mutations go through useLockActions, so
 * polling is paused (RD-rotation safety), Safe Mode arms on every lock, and
 * the 🚨 Restore button (useRecovery) reverts everything.
 */

const LTE_BANDS = [1, 2, 3, 4, 5, 7, 8, 12, 13, 17, 18, 19, 20, 25, 26, 28, 32, 38, 40, 41, 42, 66, 71];
const NR_BANDS = [1, 3, 5, 7, 8, 20, 25, 28, 38, 40, 41, 66, 71, 77, 78, 79];

const CONFIDENCE_STYLE: Record<ApiConfidence, string> = {
  verified: 'border-good/50 text-good',
  inferred: 'border-warn/50 text-warn',
  experimental: 'border-brand/50 text-brand',
};

function FeatureCard({
  f,
  children,
}: {
  f: ResolvedUnlockFeature | undefined;
  children: ReactNode;
}) {
  const t = useT();
  if (!f) return null;

  return (
    <Card
      title={t(f.labelKey)}
      actions={
        f.available ? (
          <span className="flex items-center gap-2">
            <code className="text-[10px] text-content-muted">{f.goformId}</code>
            <span className={`chip ${CONFIDENCE_STYLE[f.confidence ?? 'experimental']}`}>
              {f.confidence}
            </span>
          </span>
        ) : undefined
      }
    >
      <p className="mb-3 text-xs text-content-muted">{t(`${f.labelKey}.desc`)}</p>
      {!f.available ? (
        <EmptyState title={t('unlock.unavailable')}>
          {t('unlock.unavailableBody')}{' '}
          <code className="font-mono">{f.candidates.join(' · ')}</code>
        </EmptyState>
      ) : !f.driveable ? (
        <EmptyState title={f.goformId ?? ''}>{t('unlock.undriveable')}</EmptyState>
      ) : (
        <div className="space-y-4">
          {f.confidence !== 'verified' && (
            <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
              ⚠️ {t('unlock.experimentalWarn')}
            </p>
          )}
          {children}
        </div>
      )}
    </Card>
  );
}

export function FeatureUnlockPage() {
  const t = useT();
  const { data: db } = useApiDatabase();
  const discovery = useRunDiscovery();
  const { mutate: scan, isPending: scanning } = discovery;
  const {
    lockCell,
    unlockCell,
    lockLteBand,
    unlockLteBand,
    lockNr,
    unlockNr,
    lockNrCell,
    unlockNrCell,
    setMode,
    setAuto,
  } = useLockActions();
  const { recover, recovering, lastResult } = useRecovery();

  // On connect, determine what THIS device actually supports: run a discovery
  // pass once if the current database has nothing beyond the seed knowledge.
  const hasDiscovered = !!db?.commands.some((c) => c.source === 'discovered');
  const autoScanDone = useRef(false);
  useEffect(() => {
    if (autoScanDone.current || hasDiscovered) return;
    autoScanDone.current = true;
    scan();
  }, [hasDiscovered, scan]);

  const features = db ? resolveUnlockableFeatures(db) : [];
  const feature = (id: ResolvedUnlockFeature['feature']) =>
    features.find((f) => f.feature === id);

  const [lteBands, setLteBands] = useState<Set<number>>(new Set());
  const [nrBands, setNrBands] = useState<Set<number>>(new Set([41, 78]));
  const [ltePci, setLtePci] = useState('');
  const [lteEarfcn, setLteEarfcn] = useState('');
  const [nrPci, setNrPci] = useState('');
  const [nrArfcn, setNrArfcn] = useState('');

  const toggleIn =
    (setter: Dispatch<SetStateAction<Set<number>>>) => (band: number) =>
      setter((prev) => {
        const next = new Set(prev);
        next.has(band) ? next.delete(band) : next.add(band);
        return next;
      });

  return (
    <div className="space-y-5">
      <Card
        title={t('unlock.title')}
        actions={
          <button className="btn-ghost" onClick={() => scan()} disabled={scanning}>
            <Icon name="refresh" /> {scanning ? t('unlock.scanning') : t('unlock.rescan')}
          </button>
        }
      >
        <p className="text-sm text-content-muted">{t('unlock.intro')}</p>
        {scanning && (
          <div className="mt-3">
            <Spinner label={t('unlock.scanning')} />
          </div>
        )}
        {discovery.data?.errors.length ? (
          <p className="mt-2 text-xs text-warn">{t('unlock.scanErrors')}</p>
        ) : null}

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs text-content-muted">{t('unlock.restoreDesc')}</p>
          <ConfirmButton
            label={t('unlock.restore')}
            danger
            onConfirm={() => void recover()}
            pending={recovering}
          />
          {lastResult && (
            <p
              className={`mt-3 rounded-lg border p-2 text-sm ${
                lastResult.ok
                  ? 'border-good/40 bg-good/10 text-good'
                  : 'border-warn/40 bg-warn/10 text-warn'
              }`}
            >
              {lastResult.ok ? t('opt.freed') : t('opt.freedPartial')}
            </p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <FeatureCard f={feature('lteBandLock')}>
          <BandSelector
            rat="LTE"
            options={LTE_BANDS}
            selected={lteBands}
            onToggle={toggleIn(setLteBands)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label={`${t('unlock.lock')} (${lteBands.size})`}
              onConfirm={() => lockLteBand.mutate([...lteBands])}
              disabled={lteBands.size === 0}
              pending={lockLteBand.isPending}
            />
            <ConfirmButton
              label={t('unlock.unlockBtn')}
              danger
              onConfirm={() => unlockLteBand.mutate()}
              pending={unlockLteBand.isPending}
            />
          </div>
          <MutationResult mutation={lockLteBand} hintKey="result.hint.lteBand" />
          <MutationResult mutation={unlockLteBand} />
        </FeatureCard>

        <FeatureCard f={feature('lteCellLock')}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PCI</label>
              <input
                className="input"
                value={ltePci}
                onChange={(e) => setLtePci(e.target.value)}
                placeholder="224"
              />
            </div>
            <div>
              <label className="label">EARFCN</label>
              <input
                className="input"
                value={lteEarfcn}
                onChange={(e) => setLteEarfcn(e.target.value)}
                placeholder="1650"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label={t('unlock.lock')}
              onConfirm={() => lockCell.mutate({ pci: Number(ltePci), earfcn: Number(lteEarfcn) })}
              disabled={!ltePci || !lteEarfcn}
              pending={lockCell.isPending}
            />
            <ConfirmButton
              label={t('unlock.unlockBtn')}
              danger
              onConfirm={() => unlockCell.mutate()}
              pending={unlockCell.isPending}
            />
          </div>
          <MutationResult mutation={lockCell} hintKey="result.hint.cell" />
          <MutationResult mutation={unlockCell} />
        </FeatureCard>

        <FeatureCard f={feature('nrBandLock')}>
          <div className="flex flex-wrap gap-2">
            {Object.keys(NR_PRESETS).map((name) => (
              <button
                key={name}
                className="chip cursor-pointer hover:border-brand"
                onClick={() => setNrBands(new Set(NR_PRESETS[name]))}
              >
                {name}
              </button>
            ))}
          </div>
          <BandSelector
            rat="NR"
            options={NR_BANDS}
            selected={nrBands}
            onToggle={toggleIn(setNrBands)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label={`${t('unlock.lock')} (${nrBands.size})`}
              onConfirm={() => lockNr.mutate([...nrBands])}
              disabled={nrBands.size === 0}
              pending={lockNr.isPending}
            />
            <ConfirmButton
              label={t('unlock.unlockBtn')}
              danger
              onConfirm={() => unlockNr.mutate()}
              pending={unlockNr.isPending}
            />
          </div>
          <MutationResult mutation={lockNr} hintKey="result.hint.nrBand" />
          <MutationResult mutation={unlockNr} />
        </FeatureCard>

        <FeatureCard f={feature('nrCellLock')}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PCI</label>
              <input
                className="input"
                value={nrPci}
                onChange={(e) => setNrPci(e.target.value)}
                placeholder="206"
              />
            </div>
            <div>
              <label className="label">NR-ARFCN</label>
              <input
                className="input"
                value={nrArfcn}
                onChange={(e) => setNrArfcn(e.target.value)}
                placeholder="627264"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label={t('unlock.lock')}
              onConfirm={() => lockNrCell.mutate({ pci: Number(nrPci), arfcn: Number(nrArfcn) })}
              disabled={!nrPci || !nrArfcn}
              pending={lockNrCell.isPending}
            />
            <ConfirmButton
              label={t('unlock.unlockBtn')}
              danger
              onConfirm={() => unlockNrCell.mutate()}
              pending={unlockNrCell.isPending}
            />
          </div>
          <MutationResult mutation={lockNrCell} hintKey="result.hint.cell" />
          <MutationResult mutation={unlockNrCell} />
        </FeatureCard>

        <FeatureCard f={feature('networkMode')}>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              label={t('opt.netmode.auto')}
              onConfirm={() => setAuto.mutate()}
              pending={setAuto.isPending}
            />
            <ConfirmButton
              label={t('opt.netmode.4g')}
              onConfirm={() => setMode.mutate('Only_LTE')}
              pending={setMode.isPending}
            />
          </div>
          <MutationResult mutation={setAuto} />
          <MutationResult mutation={setMode} />
        </FeatureCard>
      </div>
    </div>
  );
}
