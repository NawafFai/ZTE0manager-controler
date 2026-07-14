import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from '@/router/nav';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';

const GROUP_ORDER: NavItem['group'][] = [
  'Overview',
  'Radio',
  'Reverse Engineering',
  'System',
];

export function Sidebar() {
  const t = useT();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface-2">
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
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
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
        {t('app.localonly')}
      </div>
    </aside>
  );
}
