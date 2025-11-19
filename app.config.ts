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
  runtimeVersion: {
    policy: 'sdkVersion',
  },
  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#87CEEB',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.sunbim.app',
    buildNumber: '2',
    infoPlist: {
      NSCameraUsageDescription: 'Sunbim a besoin d\'accéder à la caméra pour capturer vos nuages quotidiens.',
      NSPhotoLibraryUsageDescription: 'Sunbim a besoin d\'accéder à vos photos pour sauvegarder vos créations.',
      NSPhotoLibraryAddUsageDescription: 'Sunbim a besoin de sauvegarder vos dessins dans votre galerie.',
      ITSAppUsesNonExemptEncryption: false,
    },
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
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: 'Sunbim a besoin d\'accéder à la caméra pour capturer vos nuages quotidiens.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#87CEEB',
        sounds: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '6ac7da66-fe81-4d00-b064-035f9535e691',
    },
  },
});
