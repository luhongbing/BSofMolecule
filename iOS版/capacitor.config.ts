import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.molecule.moleculeviewer',
  appName: '分子漫游',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#0a0a0a',
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
};

export default config;
