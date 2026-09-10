import * as SecureStore from 'expo-secure-store';

export type NotificationPreferences = {
  reviewRequired: boolean;
  paymentPhoneHealth: boolean;
  syncIssues: boolean;
};

const DEFAULTS: NotificationPreferences = { reviewRequired: true, paymentPhoneHealth: true, syncIssues: true };
const keyFor = (userId: string, workspaceId: string) => `paytsek.notification-preferences.v1.${userId}.${workspaceId}`;

export async function getNotificationPreferences(userId: string, workspaceId: string): Promise<NotificationPreferences> {
  const stored = await SecureStore.getItemAsync(keyFor(userId, workspaceId));
  if (!stored) return DEFAULTS;
  try { return { ...DEFAULTS, ...(JSON.parse(stored) as Partial<NotificationPreferences>) }; } catch { return DEFAULTS; }
}

export function setNotificationPreferences(userId: string, workspaceId: string, preferences: NotificationPreferences) {
  return SecureStore.setItemAsync(keyFor(userId, workspaceId), JSON.stringify(preferences));
}
