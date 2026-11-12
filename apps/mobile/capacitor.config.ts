import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.family.cookbook',
  appName: 'Пухня',
  webDir: 'dist',
  android: {
    backgroundColor: '#FDF0D5',
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2D5A43',
    },
  },
};

export default config;
