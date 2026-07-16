/** Minimal stroke-icon set (no icon-font dependency). 24x24 viewBox. */
export type IconName =
  | 'dashboard'
  | 'activity'
  | 'lte'
  | 'nr'
  | 'tower'
  | 'explorer'
  | 'console'
  | 'developer'
  | 'settings'
  | 'plug'
  | 'sun'
  | 'moon'
  | 'refresh'
  | 'lock'
  | 'unlock'
  | 'optimize'
  | 'key'
  | 'menu';

const PATHS: Record<IconName, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  lte: 'M4 6v12M4 18h6M14 6v12h6',
  nr: 'M4 18V6l7 12V6M17 6h4M19 6v12',
  tower: 'M12 2v20M7 7l10 10M17 7L7 17M9 12h6',
  explorer: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z',
  console: 'M4 4h16v16H4zM8 9l3 3-3 3M13 15h4',
  developer: 'M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3m0-8V5a2 2 0 00-2-2h-3',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h5l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z',
  plug: 'M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8zM12 17v5',
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
  refresh: 'M21 12a9 9 0 11-2.6-6.4M21 3v6h-6',
  lock: 'M6 10V8a6 6 0 1112 0v2M5 10h14v10H5z',
  unlock: 'M7 10V8a5 5 0 019.6-2M5 10h14v10H5z',
  optimize: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  key: 'M21 2l-2 2M11.4 11.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zM11.4 11.6L15.5 7.5l3 3L22 7l-3-3-3.5 3.5',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
