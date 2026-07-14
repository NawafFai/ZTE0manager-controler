import { useMutation } from '@tanstack/react-query';
import { Card, Field } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ConfirmButton';
import { MutationResult } from '@/components/MutationResult';
import { useConnectionStore, useThemeStore, useClient, useSafeModeStore } from '@/store';
import { allPlugins } from '@/plugins';
import { AUTH_STRATEGIES } from '@/api';
import { rebootDevice } from '@/services';
import { orDash } from '@/utils/format';
import { useT } from '@/i18n';

export function Settings() {
  const { baseUrl, setBaseUrl, status, connect, device, router, refreshIdentity } =
    useConnectionStore();
  const { theme, setTheme } = useThemeStore();
  const safe = useSafeModeStore();
  const t = useT();
  const client = useClient();
  const reboot = useMutation({ mutationFn: () => rebootDevice(client!) });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="Connection">
        <label className="label">Router base URL (proxy target)</label>
        <input
          className="input font-mono"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="(empty = same-origin proxy)"
        />
        <p className="mt-1 text-xs text-content-muted">
          Leave empty to use the built-in dev/reverse proxy (recommended). Set a full URL only if
          the router allows cross-origin requests.
        </p>
        <button className="btn-primary mt-4" onClick={() => connect()}>
          Reconnect
        </button>
        <p className="mt-2 text-xs text-content-muted">Status: {status}</p>
      </Card>

      <Card title="Appearance">
        <label className="label">Theme</label>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`chip cursor-pointer px-4 py-1.5 capitalize ${
                theme === t ? 'border-brand text-brand' : 'text-content-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Detected router">
        <Field label="Model" value={orDash(device?.model)} />
        <Field label="Firmware" value={orDash(device?.firmware)} />
        <Field label="Hardware" value={orDash(device?.hardwareVersion)} />
        <Field label="Matched plugin" value={orDash(router?.plugin.name)} />
        <Field label="Auth strategy" value={orDash(router?.authStrategy.id)} />
      </Card>

      <Card title="Available plugins">
        <ul className="space-y-1 text-sm">
          {allPlugins().map((p) => (
            <li key={p.id} className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
              <span>{p.name}</span>
              <span className="chip border-border text-content-muted">
                {p.models.length ? p.models.join(', ') : 'fallback'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-content-muted">
          Auth strategies registered: {Object.keys(AUTH_STRATEGIES).join(', ')}
        </p>
      </Card>

      <Card title={t('safe.title')}>
        <p className="mb-3 text-sm text-content-muted">{t('safe.desc')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={safe.enabled}
            onChange={(e) => safe.setEnabled(e.target.checked)}
          />
          {t('safe.title')}
        </label>
        <div className="mt-3 max-w-[200px]">
          <label className="label">{t('safe.timeout')}</label>
          <input
            type="number"
            min={15}
            className="input"
            value={safe.timeoutSec}
            disabled={!safe.enabled}
            onChange={(e) => safe.setTimeoutSec(Number(e.target.value) || 60)}
          />
        </div>
      </Card>

      <Card
        title="Device actions"
        actions={<span className="chip border-warn/50 text-warn">experimental</span>}
      >
        <p className="mb-3 text-sm text-content-muted">
          These change device state and require confirmation. Verify against your firmware.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => refreshIdentity()} disabled={!client}>
            Refresh identity
          </button>
          <ConfirmButton
            label="Reboot router"
            confirmLabel="Reboot now"
            danger
            disabled={!client}
            pending={reboot.isPending}
            onConfirm={() => reboot.mutate()}
          />
        </div>
        <MutationResult mutation={reboot} />
      </Card>

      <Card title="Privacy & security" className="lg:col-span-2">
        <p className="text-sm text-content-muted">
          Everything runs locally in your browser. The app talks only to your router through a
          localhost proxy — no data is sent to any cloud service, and there is no telemetry.
          Reverse-engineering snapshots and console history are stored in this browser's
          localStorage only.
        </p>
      </Card>
    </div>
  );
}
