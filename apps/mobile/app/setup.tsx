import React from 'react';
import { EmptyState, Notice, Screen } from '@/components/ui';

/** Shown when the build has no backend configuration (never crash, never fake data). */
export default function SetupScreen() {
  return (
    <Screen>
      <EmptyState icon="server-off" title="PayTsek is not configured" body="Add the mobile environment settings, then rebuild the development client." />
      <Notice kind="warning">This build is missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env and rebuild the development client.</Notice>
    </Screen>
  );
}
