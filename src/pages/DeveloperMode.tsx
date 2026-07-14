import { useState } from 'react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { useDevLogStore, useClient } from '@/store';
import type { GoformTrafficEvent } from '@/api';
import { download } from '@/utils/format';
import { Icon } from '@/components/ui/Icon';

export function DeveloperMode() {
  const { events, paused, setPaused, clear } = useDevLogStore();
  const client = useClient();
  const [selected, setSelected] = useState<GoformTrafficEvent | null>(null);
  const [replayResult, setReplayResult] = useState<string>('');

  const replay = async (event: GoformTrafficEvent) => {
    if (!client) return;
    setReplayResult('// replaying…');
    try {
      const result =
        event.method === 'GET'
          ? await client.get({ cmd: (event.params.cmd ?? '').split(',').filter(Boolean) })
          : await client.set({
              goformId: event.label,
              params: Object.fromEntries(
                Object.entries(event.params).filter(([k]) => !['goformId', 'AD', 'RD', 'isTest'].includes(k)),
              ),
            });
      setReplayResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setReplayResult(`// Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <Card
          title={`Network log (${events.length})`}
          actions={
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => setPaused(!paused)}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => download('zte-network-log.json', JSON.stringify(events, null, 2))}
              >
                Export
              </button>
              <button className="btn-ghost" onClick={clear}>
                <Icon name="refresh" /> Clear
              </button>
            </div>
          }
        >
          {events.length === 0 ? (
            <EmptyState title="No traffic captured">
              Every request the app makes to the router is logged here in real time.
            </EmptyState>
          ) : (
            <div className="max-h-[540px] overflow-y-auto font-mono text-xs">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`flex w-full items-center gap-2 border-b border-border/50 px-1 py-1.5 text-left hover:bg-surface-3 ${
                    selected?.id === e.id ? 'bg-brand/10' : ''
                  }`}
                >
                  <span className={e.ok ? 'text-good' : 'text-bad'}>{e.ok ? '●' : '✕'}</span>
                  <span className="w-10 text-content-muted">{e.method}</span>
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  <span className="text-content-muted">{e.durationMs}ms</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Inspector">
          {!selected ? (
            <p className="text-sm text-content-muted">Select a request to inspect.</p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-content-muted">endpoint</span>
                <span className="font-mono">{selected.endpoint}</span>
              </div>
              <div>
                <div className="text-content-muted">params</div>
                <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 font-mono">
                  {JSON.stringify(selected.params, null, 2)}
                </pre>
              </div>
              {selected.responsePreview && (
                <div>
                  <div className="text-content-muted">response</div>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface p-2 font-mono">
                    {selected.responsePreview}
                  </pre>
                </div>
              )}
              {selected.error && <p className="text-bad">{selected.error}</p>}
              <button className="btn-primary mt-2" onClick={() => replay(selected)} disabled={!client}>
                Replay request
              </button>
            </div>
          )}
        </Card>

        {replayResult && (
          <Card title="Replay result">
            <pre className="max-h-64 overflow-auto rounded bg-surface p-2 font-mono text-xs">
              {replayResult}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
