import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'me.frutin.govchat',
  appName: 'ГоВЧат',
  webDir: 'frontend/build',
  server: {
    androidScheme: 'http'
  }
};

export default config;
