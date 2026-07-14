import { useState, type ReactNode } from 'react';
import { useConnectionStore, useCredentialsStore } from '@/store';
import { Card, Spinner } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { loginErrorMessage } from '@/services';
import { useT } from '@/i18n';

/**
 * Gate for pages that need an authenticated router session. Performs a native
 * SHA-256 login so the session lives in the app's own request context (this is
 * what makes signal reads + band/cell locks work). Supports "remember me".
 */
export function ConnectionGate({ children }: { children: ReactNode }) {
  const { status, loggedIn, login } = useConnectionStore();
  const creds = useCredentialsStore();
  const t = useT();
  const [password, setPassword] = useState(creds.remember ? creds.password : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'connected' && loggedIn) return <>{children}</>;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await login(password);
      if (result.ok) {
        if (creds.remember) creds.save(password);
      } else {
        setError(loginErrorMessage(result.code));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gate.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg pt-10">
      <Card title={t('gate.title')}>
        <p className="text-sm text-content-muted">{t('gate.body')}</p>

        <label className="label mt-4">{t('gate.password')}</label>
        <input
          className="input"
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && submit()}
          placeholder="••••••••"
        />

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={creds.remember}
            onChange={(e) => {
              creds.setRemember(e.target.checked);
              if (e.target.checked && password) creds.save(password);
            }}
          />
          {t('gate.remember')}
        </label>
        <p className="mt-1 text-xs text-content-muted">{t('gate.rememberHint')}</p>

        {busy && (
          <div className="mt-4">
            <Spinner label={t('gate.loggingIn')} />
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            {error}
          </p>
        )}

        <button className="btn-primary mt-4" onClick={submit} disabled={busy || !password}>
          <Icon name="plug" /> {t('gate.login')}
        </button>
      </Card>
    </div>
  );
}
