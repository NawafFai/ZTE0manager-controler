import { useMemo, useState } from 'react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { useApiDatabase, useRunDiscovery } from '@/hooks';
import { groupByCategory } from '@/reverse/database';
import { generateApiMarkdown } from '@/reverse/docgen';
import { download } from '@/utils/format';
import { Icon } from '@/components/ui/Icon';
import type { ApiCommand, ApiConfidence } from '@/types';

const CONFIDENCE_STYLE: Record<ApiConfidence, string> = {
  verified: 'border-good/50 text-good',
  inferred: 'border-warn/50 text-warn',
  experimental: 'border-brand/50 text-brand',
};

function CommandRow({ cmd }: { cmd: ApiCommand }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/60 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm text-content">{cmd.id}</code>
          <span className="chip border-border text-content-muted">{cmd.method}</span>
          {cmd.mutating && <span className="chip border-bad/40 text-bad">mutating</span>}
        </div>
        {cmd.description && <p className="mt-0.5 text-xs text-content-muted">{cmd.description}</p>}
        {cmd.foundIn?.length ? (
          <p className="mt-0.5 truncate text-[10px] text-content-muted">
            found in: {cmd.foundIn.join(', ')}
          </p>
        ) : null}
      </div>
      <span className={`chip shrink-0 ${CONFIDENCE_STYLE[cmd.confidence]}`}>{cmd.confidence}</span>
    </div>
  );
}

export function ApiExplorer() {
  const { data: db } = useApiDatabase();
  const discovery = useRunDiscovery();
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    if (!db) return [];
    const filtered = filter
      ? {
          ...db,
          commands: db.commands.filter((c) =>
            (c.id + c.category).toLowerCase().includes(filter.toLowerCase()),
          ),
        }
      : db;
    return [...groupByCategory(filtered)].sort((a, b) => b[1].length - a[1].length);
  }, [db, filter]);

  const result = discovery.data;

  return (
    <div className="space-y-5">
      <Card
        title="API database"
        actions={
          <div className="flex items-center gap-2">
            {db && (
              <button
                className="btn-ghost"
                onClick={() => download('zte-api-reference.md', generateApiMarkdown(db), 'text/markdown')}
              >
                Export docs
              </button>
            )}
            <button className="btn-primary" onClick={() => discovery.mutate()} disabled={discovery.isPending}>
              <Icon name="refresh" /> {discovery.isPending ? 'Scanning…' : 'Discover APIs'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-content-muted">
          {db ? `${db.commands.length} commands` : 'No database'} · seed knowledge is merged with
          commands discovered by crawling the router's JavaScript. Nothing is sent off-device.
        </p>

        {result && (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Files crawled" value={result.crawledFiles.length} />
            <Stat label="Added" value={result.diff?.added.length ?? 0} accent="var(--good)" />
            <Stat label="Removed" value={result.diff?.removed.length ?? 0} accent="var(--bad)" />
            <Stat label="Changed" value={result.diff?.changed.length ?? 0} accent="var(--warn)" />
          </div>
        )}
        {result?.errors.length ? (
          <p className="mt-2 text-xs text-warn">
            {result.errors.length} file(s) unreachable — this is normal if not connected.
          </p>
        ) : null}

        <input
          className="input mt-4"
          placeholder="Filter commands…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Card>

      {groups.length === 0 ? (
        <EmptyState title="No commands match" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {groups.map(([category, commands]) => (
            <Card key={category} title={`${category} (${commands.length})`}>
              {commands.map((cmd) => (
                <CommandRow key={`${cmd.method}:${cmd.id}`} cmd={cmd} />
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2 text-center">
      <div className="text-lg font-semibold" style={accent ? { color: `rgb(${accent})` } : undefined}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-content-muted">{label}</div>
    </div>
  );
}
