import { useConnectionStore, useThemeStore } from '@/store';
import { Icon } from '@/components/ui/Icon';
import { useRecovery } from '@/hooks';
import { useLangStore, useT } from '@/i18n';

const STATUS_STYLE: Record<string, string> = {
  connected: 'text-good',
  connecting: 'text-warn',
  error: 'text-bad',
  disconnected: 'text-content-muted',
};

export function Topbar() {
  const { status, device, router, connect, disconnect, loggedIn } = useConnectionStore();
  const { theme, toggle } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { recover, recovering } = useRecovery();
  const t = useT();

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-2 text-sm ${STATUS_STYLE[status]}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {t(`status.${status}`)}
        </span>
        {status === 'connected' && !loggedIn && (
          <span className="chip border-warn/60 text-warn" title={t('status.notLoggedIn')}>
            ⚠ {t('status.notLoggedIn')}
          </span>
        )}
        {device?.model && (
          <span className="text-sm text-content-muted">
            {device.model}
            {router && (
              <span className="mx-2 chip border-border text-content-muted">{router.plugin.name}</span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {status === 'connected' && (
          <button
            className="btn-danger animate-none"
            onClick={() => recover()}
            disabled={recovering}
            title={t('panic')}
          >
            <Icon name="unlock" /> {recovering ? t('panic.working') : t('panic')}
          </button>
        )}
        <button
          className="btn-ghost"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          aria-label="Toggle language"
          title="العربية / English"
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
        {status === 'connected' ? (
          <button className="btn-ghost" onClick={disconnect}>
            <Icon name="plug" /> {t('btn.disconnect')}
          </button>
        ) : (
          <button className="btn-primary" onClick={() => connect()}>
            <Icon name="plug" /> {t('btn.connect')}
          </button>
        )}
        <button className="btn-ghost" onClick={toggle} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
