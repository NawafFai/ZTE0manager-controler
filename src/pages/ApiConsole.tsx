import { useState } from 'react';
import Editor from '@monaco-editor/react';
import '@/components/editor/monaco-setup';
import { Card, EmptyState } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ConfirmButton';
import { useClient, useConsoleStore, useThemeStore } from '@/store';
import type { ConsoleEntry } from '@/store';
import { Icon } from '@/components/ui/Icon';

function parseParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    const [k, ...rest] = pair.split('=');
    if (k?.trim()) out[k.trim()] = rest.join('=').trim();
  }
  return out;
}

export function ApiConsole() {
  const client = useClient();
  const theme = useThemeStore((s) => s.theme);
  const { history, favorites, pushHistory, addFavorite, removeFavorite, clearHistory } =
    useConsoleStore();

  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [target, setTarget] = useState('network_type,signalbar');
  const [params, setParams] = useState('');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!client) {
      setResponse('// Not connected. Connect to the router first.');
      return;
    }
    setBusy(true);
    try {
      const result =
        method === 'GET'
          ? await client.get({ cmd: target.split(',').map((s) => s.trim()).filter(Boolean) })
          : await client.set({ goformId: target.trim(), params: parseParams(params) });
      setResponse(JSON.stringify(result, null, 2));
      pushHistory({ method, target, params });
    } catch (err) {
      setResponse(`// Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const load = (entry: ConsoleEntry) => {
    setMethod(entry.method);
    setTarget(entry.target);
    setParams(entry.params);
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card title="Request">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Method</label>
              <select
                className="input w-28"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
              >
                <option>GET</option>
                <option>POST</option>
              </select>
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="label">{method === 'GET' ? 'Command(s) — comma separated' : 'goformId'}</label>
              <input className="input font-mono" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>

          {method === 'POST' && (
            <div className="mt-3">
              <label className="label">Params (key=value&key2=value2)</label>
              <input
                className="input font-mono"
                value={params}
                onChange={(e) => setParams(e.target.value)}
                placeholder="lte_pci_lock=224&lte_earfcn_lock=1650"
              />
              <p className="mt-1 text-xs text-warn">
                POST commands mutate router state — RD/AD auth tokens are attached automatically.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {method === 'GET' ? (
              <button className="btn-primary" onClick={run} disabled={busy}>
                <Icon name="console" /> {busy ? 'Sending…' : 'Send'}
              </button>
            ) : (
              <ConfirmButton label="Send POST" danger onConfirm={run} pending={busy} />
            )}
            <button className="btn-ghost" onClick={() => addFavorite({ method, target, params })}>
              ★ Save favourite
            </button>
          </div>
        </Card>

        <Card title="Response">
          <div className="overflow-hidden rounded-lg border border-border">
            <Editor
              height="360px"
              defaultLanguage="json"
              value={response || '// Response will appear here'}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card
          title="Favourites"
          actions={<span className="text-xs text-content-muted">{favorites.length}</span>}
        >
          {favorites.length === 0 ? (
            <EmptyState title="No favourites yet" />
          ) : (
            <ul className="space-y-1">
              {favorites.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <button className="min-w-0 flex-1 truncate text-left text-sm hover:text-brand" onClick={() => load(f)}>
                    <span className="text-content-muted">{f.method}</span> {f.target}
                  </button>
                  <button className="text-content-muted hover:text-bad" onClick={() => removeFavorite(f.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="History"
          actions={
            <button className="text-xs text-content-muted hover:text-content" onClick={clearHistory}>
              clear
            </button>
          }
        >
          {history.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id}>
                  <button className="w-full truncate text-left text-sm hover:text-brand" onClick={() => load(h)}>
                    <span className="text-content-muted">{h.method}</span> {h.target}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
