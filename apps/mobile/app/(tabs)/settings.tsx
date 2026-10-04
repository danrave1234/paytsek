import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { clearInactiveCache } from '@/lib/queries';
import { pruneSynced } from '@/lib/drafts';
import { Linking, Platform, View } from 'react-native';
import { IconButton, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';
import { AppUpdateDialog } from '@/components/app-update-dialog';
import { Group, ListRow, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { useAppUpdate } from '@/lib/release-update';
import { useIsOwner, useSession } from '@/lib/session';
import { useThemeMode } from '@/lib/theme-mode';
import { DEFAULT_CAPTURE_PREFERENCES, getCapturePreferences, setCapturePreferences, type CapturePreferences } from '@/lib/capture-preferences';
import { SIGN_OUT_RETRY_MESSAGE } from '@/lib/sign-out';

export default function Settings() {
  const router = useRouter();
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const nextMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
  const isOwner = useIsOwner();
  const { workspace, signOut, selectWorkspace, workspaces } = useSession();
  const update = useAppUpdate();
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [capturePreferences, setLocalCapturePreferences] = useState<CapturePreferences>(DEFAULT_CAPTURE_PREFERENCES);
  useEffect(() => { void getCapturePreferences().then(setLocalCapturePreferences); }, []);
  const updateCapturePreference = async (key: keyof CapturePreferences, value: boolean) => {
    const previous = capturePreferences;
    const next = { ...capturePreferences, [key]: value };
    setLocalCapturePreferences(next);
    try { await setCapturePreferences(next); }
    catch { setLocalCapturePreferences(previous); setCacheMessage('Could not save that preference.'); }
  };
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
  const leave = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); }
    catch { setCacheMessage(SIGN_OUT_RETRY_MESSAGE); }
    finally { setSigningOut(false); }
  };

  return (
    <Screen tabbed>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <ScreenTitle title="Settings" />
        <IconButton
          icon={mode === 'system' ? 'theme-light-dark' : mode === 'light' ? 'weather-sunny' : 'weather-night'}
          mode="contained-tonal"
          size={20}
          onPress={() => void setMode(nextMode)}
          accessibilityLabel={`Theme: ${mode}. Switch to ${nextMode} mode`}
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
        <ListRow
          icon="camera-outline"
          title="Open Scan when PayTsek starts"
          subtitle="Deep links to records and settings still open their requested page"
          right={<Switch value={capturePreferences.openScannerOnLaunch} onValueChange={(value) => void updateCapturePreference('openScannerOnLaunch', value)} />}
        />
        <ListRow
          icon="camera-timer"
          title="Auto-capture clear proofs"
          subtitle="Requires two matching on-device reads; manual capture stays available"
          right={<Switch value={capturePreferences.autoCapture} onValueChange={(value) => void updateCapturePreference('autoCapture', value)} />}
        />
        <ListRow icon="shield-check-outline" title="Permissions checklist" subtitle="Verify camera, notifications, and listener access" onPress={() => router.push('/settings/permissions' as any)} />
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
          title="Report a problem"
          subtitle="Send privacy-safe diagnostics to help us fix issues"
          onPress={() => router.push('/settings/report-problem' as any)}
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

      <ListRow icon="logout" title={signingOut ? 'Signing out…' : 'Sign out'} destructive onPress={signingOut ? undefined : () => void leave()} />

      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayTsek {APP_VERSION}
      </Text>
      <AppUpdateDialog update={update.data} visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
      <Portal><Snackbar visible={cacheMessage !== null} duration={3200} onDismiss={() => setCacheMessage(null)}>{cacheMessage}</Snackbar></Portal>
    </Screen>
  );
}
