import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from '@/router/nav';
import { Icon } from '@/components/ui/Icon';
import { useT, useLangStore } from '@/i18n';

const GROUP_ORDER: NavItem['group'][] = [
  'Overview',
  'Radio',
  'Reverse Engineering',
  'System',
];

/**
 * Navigation. A static column on desktop (lg+), and a slide-in drawer on
 * mobile that dims the page behind it and closes when a link is tapped or the
 * overlay is touched. RTL-aware: it docks and slides from the inline-start
 * edge (left in English, right in Arabic).
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  // Direction-aware off-screen position for the mobile drawer. We drive the
  // transform from an inline *literal* value (not a Tailwind translate class):
  // toggling variable-based translate utilities under `transition-transform`
  // leaves the computed transform stale in some browsers. On desktop the
  // `lg:!translate-x-0` class (marked important) overrides this inline value.
  const rtl = useLangStore((s) => s.lang) === 'ar';
  const closedShift = rtl ? 'translateX(100%)' : 'translateX(-100%)';

  return (
    <>
      {/* Dim overlay — mobile only, closes the drawer on tap. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="fixed inset-y-0 start-0 z-50 flex h-full w-64 max-w-[80%] flex-col border-e border-border bg-surface-2 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:!translate-x-0"
        style={{
          transform: open ? 'translateX(0)' : closedShift,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-strong text-white">
            <Icon name="nr" size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{t('app.title')}</div>
            <div className="text-[10px] uppercase tracking-widest text-content-muted">
              {t('app.subtitle')}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {GROUP_ORDER.map((group) => (
            <div key={group} className="mt-4">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
                {t(`group.${group}`)}
              </div>
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-surface-3 font-medium text-content'
                        : 'text-content-muted hover:bg-surface-3 hover:text-content'
                    }`
                  }
                >
                  <Icon name={item.icon} />
                  {t(`nav.${item.path}`)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3 text-[10px] text-content-muted">
          <div>{t('app.localonly')}</div>
          <div className="mt-1 font-medium text-content-muted/90">{t('app.credit')}</div>
        </div>
      </aside>
    </>
  );
}
