import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, useThemeStore } from './store';
import { applyDirection, useLangStore } from './i18n';
import './styles/index.css';

// Apply persisted theme + language/direction before first paint.
applyTheme(useThemeStore.getState().theme);
useThemeStore.subscribe((state) => applyTheme(state.theme));
applyDirection(useLangStore.getState().lang);
useLangStore.subscribe((state) => applyDirection(state.lang));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // The router is a low-power device; don't poll it while the app window is
      // hidden/minimized, and treat rapid re-mounts as fresh to avoid bursts.
      refetchIntervalInBackground: false,
      gcTime: 5 * 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
