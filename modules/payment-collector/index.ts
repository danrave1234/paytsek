import { Platform } from 'react-native';

/**
 * JS API for the Android payment collector. On iOS every method is a safe
 * no-op that reports `supported: false` — there is no listener for other apps'
 * notifications on iOS and we never pretend otherwise.
 */
export interface CollectorStatus {
  supported: boolean;
  /** User granted Notification Access to PayRecord in system settings. */
  notificationAccessGranted: boolean;
  /** The listener service is currently connected to the system notification manager. */
  listenerConnected: boolean;
  pendingUploadCount: number;
  lastObservedEventAt: string | null;
  lastUploadAt: string | null;
  lastUploadError: string | null;
  /** Content-free counter of unrecognized templates since install (for diagnostics). */
  unknownTemplateCount: number;
  paused: boolean;
  appVersion: string;
  bootSessionId: string;
}

export interface DetectedProviderApp {
  provider: 'GCASH' | 'GOTYME' | 'MAYA' | 'MARIBANK';
  packageName: string;
  versionName: string | null;
  versionCode: number | null;
  signingCertSha256: string | null;
  installed: boolean;
}

export interface CollectorConfig {
  apiBaseUrl: string;
  /** Collector credential (prc_...). Stored in Keystore-backed EncryptedSharedPreferences. */
  credential: string;
  deviceId: string;
  /** Providers the owner bound this phone to; only these packages are read. */
  enabledProviders: Array<'GCASH' | 'GOTYME' | 'MAYA' | 'MARIBANK'>;
}

/**
 * A notification shape PayRecord did not recognise, captured only when the
 * owner opts in. Values are redacted on the phone before storage: digits
 * become '#', letters become 'a'/'A'. Only UNKNOWN_TEMPLATE rejections are
 * eligible — OTP and security messages are never stored.
 */
export interface TemplateSample {
  id: number;
  packageName: string;
  provider: 'GCASH' | 'GOTYME' | 'MAYA' | 'MARIBANK';
  title: string | null;
  text: string | null;
  bigText: string | null;
  lines: string[];
  appVersionName: string | null;
  capturedAt: string;
}

interface NativeModule {
  isSupported(): boolean;
  isNotificationAccessGranted(): boolean;
  openNotificationAccessSettings(): void;
  getStatus(): Promise<CollectorStatus>;
  detectProviderApps(): Promise<DetectedProviderApp[]>;
  configure(config: CollectorConfig): Promise<void>;
  clearConfiguration(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  flushNow(): Promise<{ attempted: number; acknowledged: number }>;
  /** Content-free heartbeat using the natively stored credential. */
  reportHealth(): Promise<boolean>;
  /** Deduplicated recovery: enumerate currently active notifications after reconnect. Not history. */
  recoverActiveNotifications(): Promise<number>;
  setCaptureUnknownTemplates(enabled: boolean): Promise<void>;
  isCaptureUnknownTemplates(): Promise<boolean>;
  listTemplateSamples(): Promise<TemplateSample[]>;
  exportTemplateSamples(): Promise<string>;
  clearTemplateSamples(): Promise<void>;
}

let native: NativeModule | null = null;
if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { requireNativeModule } = require('expo-modules-core') as { requireNativeModule: (name: string) => NativeModule };
  native = requireNativeModule('PaymentCollector');
}

const unsupportedStatus = (): CollectorStatus => ({
  supported: false,
  notificationAccessGranted: false,
  listenerConnected: false,
  pendingUploadCount: 0,
  lastObservedEventAt: null,
  lastUploadAt: null,
  lastUploadError: null,
  unknownTemplateCount: 0,
  paused: false,
  appVersion: '',
  bootSessionId: '',
});

export const PaymentCollector = {
  isSupported: (): boolean => native?.isSupported() ?? false,
  isNotificationAccessGranted: (): boolean => native?.isNotificationAccessGranted() ?? false,
  openNotificationAccessSettings: (): void => native?.openNotificationAccessSettings(),
  getStatus: (): Promise<CollectorStatus> => native?.getStatus() ?? Promise.resolve(unsupportedStatus()),
  detectProviderApps: (): Promise<DetectedProviderApp[]> => native?.detectProviderApps() ?? Promise.resolve([]),
  configure: (config: CollectorConfig): Promise<void> => native?.configure(config) ?? Promise.resolve(),
  clearConfiguration: (): Promise<void> => native?.clearConfiguration() ?? Promise.resolve(),
  setPaused: (paused: boolean): Promise<void> => native?.setPaused(paused) ?? Promise.resolve(),
  flushNow: (): Promise<{ attempted: number; acknowledged: number }> => native?.flushNow() ?? Promise.resolve({ attempted: 0, acknowledged: 0 }),
  reportHealth: (): Promise<boolean> => native?.reportHealth() ?? Promise.resolve(false),
  recoverActiveNotifications: (): Promise<number> => native?.recoverActiveNotifications() ?? Promise.resolve(0),

  /** Unknown-format capture. Android only; a no-op elsewhere. */
  setCaptureUnknownTemplates: (enabled: boolean): Promise<void> =>
    native?.setCaptureUnknownTemplates(enabled) ?? Promise.resolve(),
  isCaptureUnknownTemplates: (): Promise<boolean> => native?.isCaptureUnknownTemplates() ?? Promise.resolve(false),
  listTemplateSamples: (): Promise<TemplateSample[]> => native?.listTemplateSamples() ?? Promise.resolve([]),
  exportTemplateSamples: (): Promise<string> => native?.exportTemplateSamples() ?? Promise.resolve('{"samples":[]}'),
  clearTemplateSamples: (): Promise<void> => native?.clearTemplateSamples() ?? Promise.resolve(),
};
