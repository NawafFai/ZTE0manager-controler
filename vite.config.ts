import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The router serves its own web UI and enforces same-origin for the hidden
 * `/goform/*` endpoints. A browser app running on localhost therefore cannot
 * talk to it directly (CORS + cookie scoping). We proxy `/goform` and the
 * router's static JS (`/js`, `/app`) through the Vite dev server so that:
 *   - requests are same-origin from the app's point of view,
 *   - the router session cookie is forwarded transparently,
 *   - nothing ever leaves localhost.
 *
 * Set the target with `VITE_ROUTER_HOST` (defaults to the ZTE factory IP).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const routerHost = env.VITE_ROUTER_HOST || 'http://192.168.0.1';

  const proxyPaths = ['/goform', '/js', '/app', '/adm', '/img', '/language'];
  // ZTE firmware enforces a Referer/Origin CSRF check; rewrite them to the
  // router so `cmd=RD` and authenticated calls return real values in dev too.
  const configure: ProxyOptions['configure'] = (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.setHeader('origin', routerHost);
      proxyReq.setHeader('referer', `${routerHost}/index.html`);
    });
  };
  const proxy = Object.fromEntries(
    proxyPaths.map((p) => [
      p,
      {
        target: routerHost,
        changeOrigin: true,
        secure: false,
        configure,
      },
    ]),
  );

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy,
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      outDir: 'dist',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Split heavy, independently-cacheable vendors into their own chunks
          // so the app shell loads fast and Monaco only downloads on demand.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['chart.js', 'react-chartjs-2'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
    },
  };
});
