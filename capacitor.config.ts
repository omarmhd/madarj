import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android/iOS app: the live platform in a native shell.
 *
 * The app opens the site itself rather than a copy of the front end,
 * because the platform has no separate API (Inertia, by decision). So
 * a content fix reaches the app the moment it reaches the site, with no
 * store update. `www/` holds only what shows when there is no network.
 */
const config: CapacitorConfig = {
  appId: 'tech.codetale.madarij',
  appName: 'مدارج',
  webDir: 'capacitor/www',
  server: {
    url: 'https://madarij.codetale.tech',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
