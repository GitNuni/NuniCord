import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nunicord.app',
  appName: 'NuniCord',
  webDir: 'build',
  server: {
    // During development, point at your local server so hot reload works.
    // Comment this out for a production build (the app will be fully self-contained).
    // url: 'http://192.168.0.50:3001',
    // cleartext: true,
  },
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#040a0f',
    },
    Keyboard: {
      resize: 'body',
      style: 'Dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#040a0f',
    scrollEnabled: false,
  },
};

export default config;
