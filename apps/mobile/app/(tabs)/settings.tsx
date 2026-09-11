import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { clearInactiveCache } from '@/lib/queries';
import { pruneSynced } from '@/lib/drafts';
import { Platform, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { useIsOwner, useSession } from '@/lib/session';
import { useThemeMode } from '@/lib/theme-mode';

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const { setMode } = useThemeMode();
  const isOwner = useIsOwner();
  const { workspace, signOut, selectWorkspace, workspaces } = useSession();
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

      <Group title="Phone setup">
        <ListRow icon="cellphone-link" title="Phone setup" onPress={() => router.push('/onboarding')} />
      </Group>
      <Group title="This phone">
        {Platform.OS === 'android' ? (
          <ListRow
            icon="cellphone-message"
            title="Payment phone"
            onPress={() => router.push('/pair/collector')}
          />
        ) : (
          <ListRow
            icon="information-outline"
            title="Payment notifications"
            subtitle="Connect an Android phone"
          />
        )}
        <ListRow
          icon="heart-pulse"
          title="Devices & health"
          onPress={() => router.push('/settings/devices')}
        />
      </Group>

      {isOwner ? (
        <Group title="Owner">
          <ListRow
            icon="qrcode"
            title="Connect an Android payment phone"
            onPress={() => router.push('/pair')}
          />
          <ListRow
            icon="bank-outline"
            title="Payment sources"
            onPress={() => router.push('/settings/sources')}
          />
          <ListRow
            icon="inbox-arrow-down-outline"
            title="Incoming payments inbox"
            onPress={() => router.push('/settings/inbox')}
          />
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
          {Platform.OS === 'android' ? (
            <ListRow
              icon="text-search"
              title="Unknown formats"
              onPress={() => router.push('/settings/samples')}
            />
          ) : null}
        </Group>
      ) : null}

      <Group title="Data">
        <ListRow icon="broom" title={clearing ? 'Clearing cache…' : 'Clear unused cache'} subtitle={cacheMessage || undefined} onPress={() => void clearCache()} />
        <ListRow
          icon="file-export-outline"
          title="Export records"
          onPress={() => router.push('/settings/exports')}
        />
        <ListRow
          icon="shield-lock-outline"
          title="Privacy & data"
          onPress={() => router.push('/settings/privacy')}
        />
      </Group>

      <Group title="Account">
        <ListRow icon="bell-outline" title="Notifications" onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="account-cog-outline" title="Account & password" onPress={() => router.push('/settings/account')} />
        {workspaces.length > 1 ? (
          <ListRow icon="swap-horizontal" title="Switch workspace" onPress={() => void selectWorkspace(null)} />
        ) : null}
        <ListRow icon="logout" title="Sign out" destructive onPress={() => void signOut()} />
      </Group>

      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayTsek {APP_VERSION}
      </Text>
    </Screen>
  );
}
