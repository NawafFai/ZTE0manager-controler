import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SafeModeBanner } from '@/components/SafeModeBanner';

export function AppLayout({ children }: { children: ReactNode }) {
  // The sidebar is a static column on desktop and a slide-in drawer on mobile.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenu={() => setNavOpen(true)} />
        <SafeModeBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
