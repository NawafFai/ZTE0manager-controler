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

/**
 * Top bar. Compact and non-overflowing on phones: a hamburger opens the nav
 * drawer (mobile only), long text labels collapse to icons, and the secondary
 * device details hide on the narrowest screens so the essential controls
 * (Restore, connect, language, theme) always stay reachable.
 */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { status, device, router, connect, disconnect, loggedIn } = useConnectionStore();
  const { theme, toggle } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { recover, recovering } = useRecovery();
  const t = useT();

  return (
    <header
      className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2.5 sm:px-5 sm:py-3"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <button
        className="btn-ghost px-2 lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Icon name="menu" />
      </button>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className={`flex shrink-0 items-center gap-2 text-sm ${STATUS_STYLE[status]}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          <span className="hidden sm:inline">{t(`status.${status}`)}</span>
        </span>
        {status === 'connected' && !loggedIn && (
          <span className="chip shrink-0 border-warn/60 text-warn" title={t('status.notLoggedIn')}>
            ⚠<span className="hidden md:inline"> {t('status.notLoggedIn')}</span>
          </span>
        )}
        {device?.model && (
          <span className="truncate text-sm text-content-muted">
            {device.model}
            {router && (
              <span className="mx-2 hidden chip border-border text-content-muted lg:inline">
                {router.plugin.name}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {status === 'connected' && (
          <button
            className="btn-danger animate-none px-2 sm:px-3"
            onClick={() => recover()}
            disabled={recovering}
            title={t('panic')}
          >
            <Icon name="unlock" />
            <span className="hidden sm:inline">{recovering ? t('panic.working') : t('panic')}</span>
          </button>
        )}
        <button
          className="btn-ghost px-2 sm:px-3"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          aria-label="Toggle language"
          title="العربية / English"
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
        {status === 'connected' ? (
          <button
            className="btn-ghost px-2 sm:px-3"
            onClick={disconnect}
            title={t('btn.disconnect')}
          >
            <Icon name="plug" />
            <span className="hidden sm:inline">{t('btn.disconnect')}</span>
          </button>
        ) : (
          <button
            className="btn-primary px-2 sm:px-3"
            onClick={() => connect()}
            title={t('btn.connect')}
          >
            <Icon name="plug" />
            <span className="hidden sm:inline">{t('btn.connect')}</span>
          </button>
        )}
        <button className="btn-ghost px-2 sm:px-3" onClick={toggle} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
