import type { UseMutationResult } from '@tanstack/react-query';
import type { GoformSetResult } from '@/types';
import { isSuccess } from '@/services';

/**
 * Renders the outcome of a lock/set mutation inline. Interprets the firmware's
 * `result` field so a HTTP-200 with `result: "failure"` is shown as a failure.
 */
export function MutationResult<TVars>({
  mutation,
}: {
  mutation: UseMutationResult<GoformSetResult, unknown, TVars>;
}) {
  if (mutation.isPending || (!mutation.isSuccess && !mutation.isError)) return null;

  if (mutation.isError) {
    const message = mutation.error instanceof Error ? mutation.error.message : 'Request failed';
    return (
      <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 p-2 text-sm text-bad">
        {message}
      </p>
    );
  }

  const ok = mutation.data ? isSuccess(mutation.data) : false;
  return (
    <p
      className={`mt-3 rounded-lg border p-2 text-sm ${
        ok ? 'border-good/40 bg-good/10 text-good' : 'border-warn/40 bg-warn/10 text-warn'
      }`}
    >
      {ok ? 'Applied successfully.' : `Router response: ${JSON.stringify(mutation.data)}`}
    </p>
  );
}
