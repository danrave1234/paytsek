import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * PayTsek app config. Development builds only (never Expo Go): the payment
 * collector and OCR are local native modules.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PayTsek',
  slug: 'paytsek',
  owner: 'danrave1234',
  scheme: 'paytsek',
  version: '0.1.13',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0C111D',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'ph.paytsek.app',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'PayTsek uses the camera to capture a customer\u2019s payment receipt so you can keep a record of it.',
      NSPhotoLibraryUsageDescription: 'PayTsek can import a saved receipt screenshot as payment proof.',
      ITSAppUsesNonExemptEncryption: false,
    },
    // App Group shared with the share extension (staging container for shared images).
    entitlements: { 'com.apple.security.application-groups': ['group.ph.paytsek.app'] },
  },
  android: {
    package: 'ph.paytsek.app',
    // Must increase for every public APK so Android accepts it as an upgrade.
    versionCode: 12,
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
        data: [
          { scheme: 'https', host: 'paytsek.online', pathPrefix: '/pair' },
          { scheme: 'https', host: 'www.paytsek.online', pathPrefix: '/pair' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#0B5FFF' }],
    'expo-secure-store',
    'expo-sqlite',
    'expo-web-browser',
    ['expo-camera', { cameraPermission: 'PayTsek uses the camera to capture a customer\u2019s payment receipt.' }],
    ['expo-image-picker', { photosPermission: 'PayTsek can import a saved receipt screenshot.' }],
    ['expo-build-properties', {
      android: {
        minSdkVersion: 26,
        compileSdkVersion: 36,
        targetSdkVersion: 36,
        // Direct-download APKs do not need emulator-only x86 libraries.
        // Retain both real-phone ABIs: modern 64-bit and older 32-bit Android.
        buildArchs: ['armeabi-v7a', 'arm64-v8a'],
        // Standard R8 release shrinking removes unreachable Java/Kotlin code.
        enableMinifyInReleaseBuilds: true,
      },
      ios: { deploymentTarget: '16.4' },
    }],
    // Local modules: NotificationListenerService (Android) + ML Kit OCR (both) + iOS share extension.
    '../../modules/payment-collector/app.plugin.js',
    '../../modules/receipt-ocr/app.plugin.js',
    ['../../modules/receipt-ocr/share-extension.plugin.js', { appGroup: 'group.ph.paytsek.app', bundleIdentifier: 'ph.paytsek.app.share' }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // An empty value in a local .env must not erase the linked EAS project.
    eas: { projectId: process.env.EAS_PROJECT_ID || '69df480f-93e0-4430-a1c7-89e9380779b4' },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  },
});
