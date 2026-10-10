import type { CapacitorConfig } from '@capacitor/cli';

const target = (process.env.APP_TARGET || 'school').toLowerCase();
const isPortal = target === 'portal';

const config: CapacitorConfig = {
  appId: isPortal ? 'com.brightpath.portal' : 'com.brightpath.school',
  appName: isPortal ? 'Bright Path Student & Parent' : 'Bright Path School Portal',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
