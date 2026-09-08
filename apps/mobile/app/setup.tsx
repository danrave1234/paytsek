import React from 'react';
import { Text } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';

/** Shown when the build has no backend configuration (never crash, never fake data). */
export default function SetupScreen() {
  return (
    <Screen>
      <Text variant="headlineSmall">PayRecord is not configured</Text>
      <Notice kind="warning">This build is missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env and rebuild the development client.</Notice>
      <Text variant="bodyMedium">No demo or mock data is shown in this state so that production totals and billing are never mixed with fake records.</Text>
    </Screen>
  );
}
