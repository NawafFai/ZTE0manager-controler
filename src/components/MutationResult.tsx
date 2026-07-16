import type { UseMutationResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GoformSetResult } from '@/types';
import { isSuccess } from '@/services';
import { useT } from '@/i18n';

/**
 * Renders the outcome of a lock/set mutation inline — in plain, reassuring
 * language, never raw router JSON. Three cases:
 *   - thrown error  → couldn't reach/parse the router (network/timeout).
 *   - result:"failure" → the firmware declined it; we explain why and reassure
 *     that nothing changed, optionally with a feature-specific `hintKey`.
 *   - success       → a short confirmation.
 * The raw response is still available on hover (title) for debugging.
 */

function Note({
  tone,
  title,
  children,
}: {
  tone: 'good' | 'warn' | 'bad';
  title?: string;
  children: ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    good: 'border-good/40 bg-good/10 text-good',
    warn: 'border-warn/40 bg-warn/10 text-warn',
    bad: 'border-bad/40 bg-bad/10 text-bad',
  };
  return (
    <div className={`mt-3 rounded-lg border p-2.5 text-sm ${styles[tone]}`} title={title}>
      {children}
    </div>
  );
}

export function MutationResult<TVars>({
  mutation,
  hintKey,
}: {
  mutation: UseMutationResult<GoformSetResult, unknown, TVars>;
  /** Optional i18n key for a feature-specific tip shown when the action fails. */
  hintKey?: string;
}) {
  const t = useT();
  if (mutation.isPending || (!mutation.isSuccess && !mutation.isError)) return null;

  // Thrown error = couldn't reach or parse the router (network, timeout, JSON).
  if (mutation.isError) {
    return (
      <Note tone="bad" title={mutation.error instanceof Error ? mutation.error.message : undefined}>
        {t('result.network')}
      </Note>
    );
  }

  const ok = mutation.data ? isSuccess(mutation.data) : false;
  if (ok) {
    return <Note tone="good">{t('result.applied')}</Note>;
  }

  // HTTP 200 but the firmware rejected the change (result:"failure").
  return (
    <Note tone="warn" title={JSON.stringify(mutation.data)}>
      <strong className="block">{t('result.failedTitle')}</strong>
      <span className="mt-0.5 block opacity-90">{t(hintKey ?? 'result.failedBody')}</span>
    </Note>
  );
}
