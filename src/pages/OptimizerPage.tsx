import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Spinner, Notice } from '@/components/ui/primitives';
import { useOptimizer, useRecovery, useLockActions } from '@/hooks';
import { MutationResult } from '@/components/MutationResult';
import { ConfirmButton } from '@/components/ConfirmButton';
import {
  autoCandidate,
  lteBandCandidates,
  nrBandCandidates,
  readLockStatus,
  DEFAULT_PING_TARGET,
  type BenchResult,
  type Candidate,
} from '@/services';
import type { OptGoal } from '@/signals/optimizer';
import { useClient, useConnectionStore } from '@/store';
import { qualityColor, classify } from '@/signals/quality';
import { orDash } from '@/utils/format';
import { useT } from '@/i18n';

const GAMING_NR_BANDS = [78, 41];
const GAMING_LTE_BANDS = [3, 1, 20];
const BALANCE_LTE_BANDS = [3, 1, 7, 8, 20, 28, 40];
const PER_CANDIDATE_SECONDS = 12;

function ModeCard({
  emoji,
  title,
  desc,
  meta,
  onClick,
  disabled,
  tone = 'default',
  children,
}: {
  emoji: string;
  title: string;
  desc: string;
  meta?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary';
  children?: ReactNode;
}) {
  const base = 'card w-full text-start transition-colors';
  const cls =
    tone === 'primary'
      ? `${base} border-good/50 bg-good/5 hover:border-good`
      : `${base} hover:border-brand`;
  const body = (
    <>
      <div className="mb-1 flex items-center gap-2 font-semibold text-content">
        <span className="text-lg">{emoji}</span>
        {title}
      </div>
      <div className="text-xs text-content-muted">{desc}</div>
      {meta && <div className="mt-2 text-[11px] text-content-muted">{meta}</div>}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button className={`${cls} disabled:opacity-50`} disabled={disabled} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

function ResultsRow({
  r,
  best,
  gaming,
  onApply,
}: {
  r: BenchResult;
  best: boolean;
  gaming: boolean;
  onApply: () => void;
}) {
  const t = useT();
  return (
    <tr className={`border-t border-border/60 ${best ? 'bg-good/10' : ''}`}>
      <td className="py-2 pe-3 font-mono">{r.candidate.label}</td>
      <td className="py-2 pe-3">{orDash(r.sample.band)}</td>
      {gaming && (
        <>
          <td className="py-2 pe-3 font-mono">
            {r.latency?.avgMs != null ? `${Math.round(r.latency.avgMs)}ms` : '—'}
          </td>
          <td className="py-2 pe-3 font-mono">
            {r.latency?.jitterMs != null ? `${Math.round(r.latency.jitterMs)}ms` : '—'}
          </td>
          <td className="py-2 pe-3 font-mono">
            {r.latency ? `${Math.round(r.latency.lossPct)}%` : '—'}
          </td>
        </>
      )}
      <td
        className="py-2 pe-3 font-mono"
        style={{ color: qualityColor(classify('sinr', r.sample.sinr)) }}
      >
        {r.sample.sinr === null ? '—' : r.sample.sinr.toFixed(1)}
      </td>
      <td
        className="py-2 pe-3 font-mono"
        style={{ color: qualityColor(classify('rsrp', r.sample.rsrp)) }}
      >
        {r.sample.rsrp === null ? '—' : r.sample.rsrp.toFixed(0)}
      </td>
      <td className="py-2 pe-3 font-mono font-semibold">{r.score}</td>
      <td className="py-2">
        {r.applied ? (
          <span className="chip border-good/50 text-good">{t('opt.applied')}</span>
        ) : (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={onApply} disabled={r.score === 0}>
            {t('opt.applyBest')}
          </button>
        )}
      </td>
    </tr>
  );
}

export function OptimizerPage() {
  const t = useT();
  const client = useClient();
  const carrierLocked = useConnectionStore((s) => s.router?.plugin.id === 'huawei-h155');
  const { running, progress, results, error, run, cancel, applyBest } = useOptimizer();
  const { recover, recovering, lastResult } = useRecovery();
  const { setMode, setAuto } = useLockActions();
  const [pingTarget, setPingTarget] = useState(DEFAULT_PING_TARGET);
  const [lastGoal, setLastGoal] = useState<OptGoal>('gaming');
  const gaming = lastGoal === 'gaming';

  const lockStatus = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => readLockStatus(client!),
    enabled: !!client,
    refetchInterval: running ? false : 8000,
  });

  const gamingCands = useMemo(
    () => [autoCandidate(), ...nrBandCandidates(GAMING_NR_BANDS), ...lteBandCandidates(GAMING_LTE_BANDS)],
    [],
  );
  const balanceCands = useMemo(
    () => [autoCandidate(), ...lteBandCandidates(BALANCE_LTE_BANDS)],
    [],
  );

  const start = (candidates: Candidate[], goal: OptGoal) => {
    setLastGoal(goal);
    run(candidates, goal, pingTarget);
  };

  const progressPct = progress
    ? Math.round(((progress.index + (progress.phase === 'candidate-done' ? 1 : 0)) / progress.total) * 100)
    : 0;

  const gamerEta = Math.ceil((gamingCands.length * PER_CANDIDATE_SECONDS) / 60);
  const balanceEta = Math.ceil((balanceCands.length * PER_CANDIDATE_SECONDS) / 60);

  return (
    <div className="space-y-5">
      {carrierLocked && (
        <Notice tone="warn" title="المحسّن يحتاج تحكّم بالترددات المقفول من المشغّل · Optimizer needs carrier-locked controls">
          المحسّن يشتغل بقفل/تبديل الترددات وقياس الإشارة التفصيلية — وكلها مقفلة من فيرموير المشغّل على هذا الراوتر،
          فلن تعمل نتائجه هنا. يعمل بالكامل على راوتر غير مقفول (ZTE أو هواوي مفتوح). · The optimizer drives band
          locking + detailed signal sampling, all disabled by this carrier firmware; it works fully on an
          unlocked router.
        </Notice>
      )}

      {/* Persistent current status — the lock is real and stays until you change it */}
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t('opt.currentStatus')}</span>
        {lockStatus.data ? (
          lockStatus.data.anyLocked ? (
            <span className="chip border-warn/60 text-warn">🔒 {lockStatus.data.summary}</span>
          ) : (
            <span className="chip border-good/50 text-good">🔓 {t('opt.autoState')}</span>
          )
        ) : (
          <span className="text-xs text-content-muted">…</span>
        )}
      </div>

      {running ? (
        <Card title={t('opt.title')}>
          <div className="space-y-3">
            <Spinner label={`${t('opt.running')} ${progress?.candidate?.label ?? ''} (${progress?.phase ?? ''})`} />
            <div className="h-2 w-full overflow-hidden rounded bg-surface-3">
              <div className="h-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <button className="btn-danger" onClick={cancel}>
              {t('opt.cancel')}
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ModeCard
              emoji="🚀"
              tone="primary"
              title={t('opt.mode.fast')}
              desc={t('opt.mode.fast.desc')}
              meta={recovering ? '…' : undefined}
              onClick={() => recover()}
              disabled={!client || recovering}
            />
            <ModeCard
              emoji="🎮"
              title={t('opt.mode.gamer')}
              desc={t('opt.mode.gamer.desc')}
              meta={`${gamingCands.length} · ${t('opt.estimate')}: ~${gamerEta}m`}
              onClick={() => start(gamingCands, 'gaming')}
              disabled={!client}
            />
            <ModeCard
              emoji="⚖️"
              title={t('opt.mode.balance')}
              desc={t('opt.mode.balance.desc')}
              meta={`${balanceCands.length} · ${t('opt.estimate')}: ~${balanceEta}m`}
              onClick={() => start(balanceCands, 'stability')}
              disabled={!client}
            />
            <ModeCard emoji="📶" title={t('opt.netmode.title')} desc={t('opt.netmode.hint')}>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="btn-primary"
                  disabled={!client || setAuto.isPending}
                  onClick={() => setAuto.mutate()}
                >
                  {t('opt.netmode.auto')}
                </button>
                <ConfirmButton
                  label={t('opt.netmode.4g')}
                  onConfirm={() => setMode.mutate('Only_LTE')}
                  disabled={!client}
                  pending={setMode.isPending}
                />
              </div>
              <MutationResult mutation={setMode} />
              <MutationResult mutation={setAuto} />
            </ModeCard>
          </div>

          {lastResult && (
            <p
              className={`rounded-lg border p-2 text-sm ${
                lastResult.ok
                  ? 'border-good/40 bg-good/10 text-good'
                  : 'border-warn/40 bg-warn/10 text-warn'
              }`}
            >
              {lastResult.ok ? `✅ ${t('opt.freed')}` : `⚠ ${t('opt.freedPartial')}`}
            </p>
          )}

          <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs text-warn">
            ⚠ {t('opt.warning')}
          </p>

          <Card title={`🎮 ${t('opt.pingTarget')}`}>
            <input
              className="input font-mono"
              value={pingTarget}
              onChange={(e) => setPingTarget(e.target.value)}
              placeholder={DEFAULT_PING_TARGET}
            />
            <p className="mt-1 text-xs text-content-muted">{t('opt.pingHint')}</p>
          </Card>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-2 text-sm text-bad">{error}</p>
      )}

      {results.length > 0 && (
        <Card title={t('opt.results')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-content-muted">
                  <th className="py-2 pe-3">Option</th>
                  <th className="py-2 pe-3">Band</th>
                  {gaming && (
                    <>
                      <th className="py-2 pe-3">Ping</th>
                      <th className="py-2 pe-3">Jitter</th>
                      <th className="py-2 pe-3">Loss</th>
                    </>
                  )}
                  <th className="py-2 pe-3">SINR</th>
                  <th className="py-2 pe-3">RSRP</th>
                  <th className="py-2 pe-3">{t('opt.score')}</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <ResultsRow
                    key={r.candidate.id}
                    r={r}
                    best={i === 0}
                    gaming={gaming}
                    onApply={() => applyBest(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={t('opt.legend')}>
        <table className="w-full text-sm">
          <tbody>
            {[
              ['SINR', t('opt.sinr.mean'), t('opt.sinr.speed')],
              ['RSRP', t('opt.rsrp.mean'), t('opt.rsrp.speed')],
              ['CA', t('opt.ca.mean'), t('opt.ca.speed')],
              [t('opt.band.mean'), '', t('opt.band.speed')],
            ].map(([m, mean, speed]) => (
              <tr key={m} className="border-t border-border/60 align-top">
                <td className="py-1.5 pe-3 font-mono text-brand">{m}</td>
                <td className="py-1.5 pe-3">{mean}</td>
                <td className="py-1.5 text-content-muted">{speed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
