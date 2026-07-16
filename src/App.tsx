import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConnectionGate } from '@/components/ConnectionGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui/primitives';
import { useConnectionStore, useCredentialsStore } from '@/store';
import { useSafeModeWatchdog } from '@/hooks';
import {
  Dashboard,
  LiveMonitor,
  LtePage,
  NrPage,
  TowerPage,
  OptimizerPage,
  FeatureUnlockPage,
  ApiExplorer,
  DeveloperMode,
  Settings,
} from '@/pages';

// Monaco is heavy; load the API Console (and its editor) only when visited.
const ApiConsole = lazy(() =>
  import('@/pages/ApiConsole').then((m) => ({ default: m.ApiConsole })),
);

/** Pages that require a live router connection are wrapped in a gate. */
function Gated({ children }: { children: ReactNode }) {
  return <ConnectionGate>{children}</ConnectionGate>;
}

export default function App() {
  // The desktop shell dispatches `zrm:reconnect` after the router-login window
  // closes, so the app auto-connects and shows "connected" without a manual click.
  useEffect(() => {
    const handler = () => {
      void useConnectionStore.getState().connect();
    };
    window.addEventListener('zrm:reconnect', handler);
    return () => window.removeEventListener('zrm:reconnect', handler);
  }, []);

  // Safe Mode watchdog: auto-reverts risky locks if the connection drops.
  useSafeModeWatchdog();

  // Reset the error boundary when the route changes, so navigating away from a
  // page that threw recovers cleanly.
  const location = useLocation();

  // "Remember me": auto-login on startup with the saved password.
  useEffect(() => {
    const { remember, password } = useCredentialsStore.getState();
    const { status, login } = useConnectionStore.getState();
    if (remember && password && status !== 'connected') {
      void login(password);
    }
  }, []);

  return (
    <AppLayout>
      <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Gated><Dashboard /></Gated>} />
        <Route path="/live" element={<Gated><LiveMonitor /></Gated>} />
        <Route path="/lte" element={<Gated><LtePage /></Gated>} />
        <Route path="/nr" element={<Gated><NrPage /></Gated>} />
        <Route path="/tower" element={<Gated><TowerPage /></Gated>} />
        <Route path="/optimizer" element={<Gated><OptimizerPage /></Gated>} />
        <Route path="/unlock" element={<Gated><FeatureUnlockPage /></Gated>} />
        <Route path="/explorer" element={<ApiExplorer />} />
        <Route
          path="/console"
          element={
            <Suspense fallback={<Spinner label="Loading console…" />}>
              <ApiConsole />
            </Suspense>
          }
        />
        <Route path="/developer" element={<DeveloperMode />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}
