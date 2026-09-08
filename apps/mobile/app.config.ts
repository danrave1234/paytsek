import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * PayRecord app config. Development builds only (never Expo Go): the payment
 * collector and OCR are local native modules.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PayRecord',
  slug: 'payrecord',
  owner: 'danrave1234',
  scheme: 'payrecord',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'ph.payrecord.app',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'PayRecord uses the camera to capture a customer\u2019s payment receipt so you can keep a record of it.',
      NSPhotoLibraryUsageDescription: 'PayRecord can import a saved receipt screenshot as payment proof.',
      ITSAppUsesNonExemptEncryption: false,
    },
    // App Group shared with the share extension (staging container for shared images).
    entitlements: { 'com.apple.security.application-groups': ['group.ph.payrecord.app'] },
  },
  android: {
    package: 'ph.payrecord.app',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0B5FFF' },
    permissions: ['android.permission.CAMERA', 'android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'],
    // Receive shared images from other apps (share sheet import).
    intentFilters: [
      {
        action: 'SEND',
        data: [{ mimeType: 'image/*' }],
        category: ['DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'payrecord.ph', pathPrefix: '/pair' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#0B5FFF' }],
    'expo-secure-store',
    'expo-sqlite',
    ['expo-camera', { cameraPermission: 'PayRecord uses the camera to capture a customer\u2019s payment receipt.' }],
    ['expo-image-picker', { photosPermission: 'PayRecord can import a saved receipt screenshot.' }],
    ['expo-build-properties', { android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 }, ios: { deploymentTarget: '16.4' } }],
    // Local modules: NotificationListenerService (Android) + ML Kit OCR (both) + iOS share extension.
    '../../modules/payment-collector/app.plugin.js',
    '../../modules/receipt-ocr/app.plugin.js',
    ['../../modules/receipt-ocr/share-extension.plugin.js', { appGroup: 'group.ph.payrecord.app', bundleIdentifier: 'ph.payrecord.app.share' }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '2017b542-34ff-4454-8c47-201c6c2911a2' },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
    revenueCatApiKeyIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  },
});
