import * as SecureStore from 'expo-secure-store';

export type CapturePreferences = {
  openScannerOnLaunch: boolean;
  autoCapture: boolean;
};

const KEY = 'paytsek.capture-preferences.v1';
export const DEFAULT_CAPTURE_PREFERENCES: CapturePreferences = {
  openScannerOnLaunch: true,
  autoCapture: true,
};

export async function getCapturePreferences(): Promise<CapturePreferences> {
  const stored = await SecureStore.getItemAsync(KEY);
  if (!stored) return DEFAULT_CAPTURE_PREFERENCES;
  try { return { ...DEFAULT_CAPTURE_PREFERENCES, ...(JSON.parse(stored) as Partial<CapturePreferences>) }; }
  catch { return DEFAULT_CAPTURE_PREFERENCES; }
}

export async function setCapturePreferences(preferences: CapturePreferences): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(preferences));
}
