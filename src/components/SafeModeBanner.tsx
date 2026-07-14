import { useEffect, useState } from 'react';
import { useSafeModeStore } from '@/store';
import { useRecovery } from '@/hooks';
import { useT } from '@/i18n';

/**
 * Top-of-app banner for Safe Mode. Shows a live countdown while armed (with
 * "Keep" / "Revert now"), or a notice after an automatic revert.
 */
export function SafeModeBanner() {
  const { armed, lastRevert, disarm, markReverted, clearRevertNotice } = useSafeModeStore();
  const { recover, recovering } = useRecovery();
  const t = useT();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!armed) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [armed]);

  if (armed) {
    const remaining = Math.max(0, Math.ceil((armed.deadline - now) / 1000));
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-warn/40 bg-warn/10 px-5 py-2 text-sm text-warn">
        <span className="font-semibold">🛡 {t('safe.armedTitle')}</span>
        <span className="text-content-muted">
          {armed.label} · {t('safe.revertIn')} <span className="font-mono text-warn">{remaining}s</span>
        </span>
        <div className="ms-auto flex gap-2">
          <button className="btn-ghost px-2 py-1 text-xs" onClick={disarm}>
            {t('safe.keep')}
          </button>
          <button
            className="btn-danger px-2 py-1 text-xs"
            disabled={recovering}
            onClick={async () => {
              const label = armed.label;
              await recover();
              markReverted(label);
            }}
          >
            {recovering ? '…' : t('safe.revertNow')}
          </button>
        </div>
      </div>
    );
  }

  if (lastRevert) {
    return (
      <div className="flex items-center gap-3 border-b border-bad/40 bg-bad/10 px-5 py-2 text-sm text-bad">
        <span>↩ {t('safe.reverted')}</span>
        <button className="btn-ghost ms-auto px-2 py-1 text-xs" onClick={clearRevertNotice}>
          {t('safe.dismiss')}
        </button>
      </div>
    );
  }

  return null;
}
