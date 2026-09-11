import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { clearInactiveCache } from '@/lib/queries';
import { pruneSynced } from '@/lib/drafts';
import { Platform, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { useAppUpdate } from '@/lib/release-update';
import { useIsOwner, useSession } from '@/lib/session';
import { useThemeMode } from '@/lib/theme-mode';

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const { setMode } = useThemeMode();
  const isOwner = useIsOwner();
  const { workspace, signOut, selectWorkspace, workspaces } = useSession();
  const update = useAppUpdate();
  const [cacheMessage, setCacheMessage] = useState('');
  const [clearing, setClearing] = useState(false);
  const clearCache = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      clearInactiveCache();
      if (workspace) await pruneSynced(workspace.id);
      setCacheMessage('Unused cache cleared. Pending scans are safe.');
    } catch { setCacheMessage('Could not finish cleanup. Try again.'); }
    finally { setClearing(false); }
  };

  return (
    <Screen tabbed>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <ScreenTitle title="Settings" />
        <IconButton
          icon={theme.dark ? 'weather-sunny' : 'weather-night'}
          mode="contained-tonal"
          size={20}
          onPress={() => void setMode(theme.dark ? 'light' : 'dark')}
          accessibilityLabel={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
        />
      </View>

      <Group title="Payments">
        <ListRow
          icon="cellphone-link"
          title="Payment phone setup"
          subtitle={Platform.OS === 'android' ? 'Connect this phone or another Android phone' : 'Connect an Android phone'}
          onPress={() => router.push(isOwner ? '/pair' : '/pair/collector')}
        />
        {isOwner ? (
          <>
          <ListRow
            icon="bank-outline"
            title="Wallet apps"
            onPress={() => router.push('/settings/sources')}
          />
          <ListRow
            icon="inbox-arrow-down-outline"
            title="Incoming payments"
            onPress={() => router.push('/settings/inbox')}
          />
          </>
        ) : null}
        <ListRow icon="heart-pulse" title="Connected devices" onPress={() => router.push('/settings/devices')} />
      </Group>

      {isOwner ? (
        <Group title="Business">
          <ListRow
            icon="account-multiple-outline"
            title="Team"
            onPress={() => router.push('/settings/team')}
          />
          <ListRow
            icon="credit-card-outline"
            title="Plan & usage"
            onPress={() => router.push('/settings/billing')}
          />
          <ListRow icon="file-export-outline" title="Export records" onPress={() => router.push('/settings/exports')} />
        </Group>
      ) : null}

      <Group title="Preferences">
        <ListRow icon="bell-outline" title="Notifications" onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="shield-lock-outline" title="Privacy & data" onPress={() => router.push('/settings/privacy')} />
        <ListRow icon="account-cog-outline" title="Account & password" onPress={() => router.push('/settings/account')} />
        {workspaces.length > 1 ? (
          <ListRow icon="swap-horizontal" title="Switch workspace" onPress={() => void selectWorkspace(null)} />
        ) : null}
      </Group>

      <Group title="Advanced">
        {Platform.OS === 'android' && isOwner ? <ListRow icon="text-search" title="Unknown notification formats" onPress={() => router.push('/settings/samples')} /> : null}
        <ListRow icon="broom" title={clearing ? 'Clearing cache…' : 'Clear unused cache'} subtitle={cacheMessage || undefined} onPress={() => void clearCache()} />
      </Group>

      {update.data ? <Group title="App update"><ListRow icon="download" title={`PayTsek ${update.data.version} is ready`} subtitle="Download the latest signed installer from the Home screen." /></Group> : null}

      <ListRow icon="logout" title="Sign out" destructive onPress={() => void signOut()} />

      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayTsek {APP_VERSION}
      </Text>
    </Screen>
  );
}
