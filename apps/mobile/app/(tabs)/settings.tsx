import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { clearInactiveCache } from '@/lib/queries';
import { pruneSynced } from '@/lib/drafts';
import { Linking, Platform, View } from 'react-native';
import { IconButton, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { AppUpdateDialog } from '@/components/app-update-dialog';
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
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
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
        {isOwner ? (
          <>
          <ListRow
            icon="bell-badge-outline"
            title="Wallet notifications"
            subtitle={Platform.OS === 'android' ? 'Choose which wallet apps this phone listens to' : 'Connect an Android payment phone'}
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
        <Group title="Workspace">
          <ListRow
            icon="account-multiple-outline"
            title="Team"
            onPress={() => router.push('/settings/team')}
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

      <Group title="Help">
        <ListRow
          icon="help-circle-outline"
          title="Help & support"
          subtitle="Ask a question or send feedback"
          onPress={() => void Linking.openURL('mailto:support@paytsek.online?subject=PayTsek%20support')}
        />
      </Group>

      <Group title="App">
        <ListRow
          icon={update.data ? 'cellphone-arrow-down' : 'check-circle-outline'}
          title={update.data ? `PayTsek ${update.data.version} is ready` : update.isFetching ? 'Checking for updates…' : 'PayTsek is up to date'}
          subtitle={update.data ? 'View patch notes and install' : `Version ${APP_VERSION}`}
          onPress={() => update.data ? setShowUpdate(true) : void update.refetch()}
        />
      </Group>

      <Group title="Advanced">
        {Platform.OS === 'android' && isOwner ? <ListRow icon="text-search" title="Unknown notification formats" onPress={() => router.push('/settings/samples')} /> : null}
        <ListRow icon="broom" title={clearing ? 'Clearing cache…' : 'Clear unused cache'} onPress={() => void clearCache()} />
      </Group>

      <ListRow icon="logout" title="Sign out" destructive onPress={() => void signOut()} />

      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayTsek {APP_VERSION}
      </Text>
      <AppUpdateDialog update={update.data} visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
      <Portal><Snackbar visible={cacheMessage !== null} duration={3200} onDismiss={() => setCacheMessage(null)}>{cacheMessage}</Snackbar></Portal>
    </Screen>
  );
}
