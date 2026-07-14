import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor packages the same React build (`dist`) into native Android/iOS apps.
 *
 * On mobile there is no Vite/Electron proxy, so the app talks to the router
 * DIRECTLY over native HTTP (see src/api/transport.ts, which uses CapacitorHttp
 * to set the Referer/Origin the firmware requires and to persist the login
 * cookie). `cleartext: true` is required because the router is plain http.
 */
const config: CapacitorConfig = {
  appId: 'com.zteroutermanager.app',
  appName: 'ZTE Router Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
