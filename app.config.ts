import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'sunbim',
  slug: 'sunbimapp',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'sunbim',
  userInterfaceStyle: 'automatic',

  // 🔥 CORRECTION ICI : runtime fixe pour OTA
  runtimeVersion: 'exposdk:54.0.0',

  updates: {
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    url: 'https://u.expo.dev/6ac7da66-fe81-4d00-b064-035f9535e691'
  },

  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#87CEEB',
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.sunbim.app',
    buildNumber: '7',
    infoPlist: {
      NSCameraUsageDescription: "Sunbim a besoin d'accéder à la caméra pour capturer vos nuages quotidiens.",
      NSPhotoLibraryUsageDescription: "Sunbim a besoin d'accéder à vos photos pour sauvegarder vos créations.",
      NSPhotoLibraryAddUsageDescription: "Sunbim a besoin de sauvegarder vos dessins dans votre galerie.",
      ITSAppUsesNonExemptEncryption: false
    }
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#87CEEB',
    },
    package: 'com.sunbim.app',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'POST_NOTIFICATIONS',
    ],
  },

  web: {
    bundler: 'metro',
    output: 'server',
    favicon: './assets/images/favicon.png'
  },

  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: "Sunbim a besoin d'accéder à la caméra pour capturer vos nuages quotidiens."
      }
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#87CEEB',
        sounds: []
      }
    ]
  ],

  experiments: {
    typedRoutes: true
  },

  extra: {
    router: {
      origin: false
    },
    eas: {
      projectId: '6ac7da66-fe81-4d00-b064-035f9535e691'
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nnaboyzmqofqnehzmrnp.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uYWJveXptcW9mcW5laHptcm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjM0NTcsImV4cCI6MjA3MjYzOTQ1N30.EU9YFvbtKd8eX5ep54CDMF9xaUCgKZ3TihXLKbAb6pA'
  }
});
