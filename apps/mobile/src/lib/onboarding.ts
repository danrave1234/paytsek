import * as SecureStore from 'expo-secure-store';

const key = (userId: string, workspaceId: string) => `paytsek.onboarding.v1.${userId}.${workspaceId}`;
export const hasSeenOnboarding = async (userId: string, workspaceId: string) =>
  (await SecureStore.getItemAsync(key(userId, workspaceId))) === 'seen';
export const markOnboardingSeen = (userId: string, workspaceId: string) =>
  SecureStore.setItemAsync(key(userId, workspaceId), 'seen');
