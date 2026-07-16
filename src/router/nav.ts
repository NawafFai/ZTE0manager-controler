import type { IconName } from '@/components/ui/Icon';

/** Single source of truth for navigation + routing. */
export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Section grouping in the sidebar. */
  group: 'Overview' | 'Radio' | 'Reverse Engineering' | 'System';
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', group: 'Overview' },
  { path: '/live', label: 'Live Monitor', icon: 'activity', group: 'Overview' },
  { path: '/lte', label: 'LTE', icon: 'lte', group: 'Radio' },
  { path: '/nr', label: '5G / NR', icon: 'nr', group: 'Radio' },
  { path: '/tower', label: 'Tower Scanner', icon: 'tower', group: 'Radio' },
  { path: '/optimizer', label: 'Optimizer', icon: 'optimize', group: 'Radio' },
  { path: '/unlock', label: 'Feature Unlock', icon: 'key', group: 'Radio' },
  { path: '/explorer', label: 'API Explorer', icon: 'explorer', group: 'Reverse Engineering' },
  { path: '/console', label: 'API Console', icon: 'console', group: 'Reverse Engineering' },
  { path: '/developer', label: 'Developer Mode', icon: 'developer', group: 'Reverse Engineering' },
  { path: '/settings', label: 'Settings', icon: 'settings', group: 'System' },
];
