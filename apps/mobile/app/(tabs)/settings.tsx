import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { clearInactiveCache } from '@/lib/queries';
import { pruneSynced } from '@/lib/drafts';
import { Platform, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Screen, ScreenTitle } from '@/components/ui';
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
        <ScreenTitle
          title="More"
          subtitle={`${workspace?.name} · ${isOwner ? 'Owner tools' : 'Cashier tools'} · ${workspace?.planCode} plan`}
        />
        <IconButton
          icon={theme.dark ? 'weather-sunny' : 'weather-night'}
          mode="contained-tonal"
          size={20}
          onPress={() => void setMode(theme.dark ? 'light' : 'dark')}
          accessibilityLabel={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
        />
      </View>

      <Group title="Phone setup">
        <ListRow icon="cellphone-link" title="Main phone & employee scanners" subtitle="Start here · setup guide and phone roles" onPress={() => router.push('/onboarding')} />
      </Group>
      <Group title="This phone">
        {Platform.OS === 'android' ? (
          <ListRow
            icon="cellphone-message"
            title="Set up this main payment phone"
            subtitle="Receives wallet notifications · enter the owner’s pairing code"
            onPress={() => router.push('/pair/collector')}
          />
        ) : (
          <ListRow
            icon="information-outline"
            title="Payment notifications"
            subtitle="iPhone cannot read other apps' notifications. Connect an Android phone or use manual confirmation."
          />
        )}
        <ListRow
          icon="heart-pulse"
          title="Devices & health"
          subtitle="Last seen, pending uploads, notification access"
          onPress={() => router.push('/settings/devices')}
        />
      </Group>

      {isOwner ? (
        <Group title="Owner">
          <ListRow
            icon="qrcode"
            title="Connect an Android payment phone"
            subtitle="Create a 5-minute pairing code"
            onPress={() => router.push('/pair')}
          />
          <ListRow
            icon="bank-outline"
            title="Payment sources"
            subtitle="Wallet notifications received on the main payment phone"
            onPress={() => router.push('/settings/sources')}
          />
          <ListRow
            icon="inbox-arrow-down-outline"
            title="Incoming payments inbox"
            subtitle="Unmatched notifications (owner only, 7-day retention)"
            onPress={() => router.push('/settings/inbox')}
          />
          <ListRow
            icon="account-multiple-outline"
            title="Team"
            subtitle="Invite or remove cashiers"
            onPress={() => router.push('/settings/team')}
          />
          <ListRow
            icon="credit-card-outline"
            title="Plan & usage"
            subtitle="Records this month, plan and renewals"
            onPress={() => router.push('/settings/billing')}
          />
          {Platform.OS === 'android' ? (
            <ListRow
              icon="text-search"
              title="Unknown formats"
              subtitle="Help add support for a wallet that cannot auto-match yet"
              onPress={() => router.push('/settings/samples')}
            />
          ) : null}
        </Group>
      ) : null}

      <Group title="Data">
        <ListRow icon="broom" title={clearing ? 'Clearing cache…' : 'Clear unused cache'} subtitle={cacheMessage || 'Free memory and remove uploaded local copies. Pending scans stay on this phone.'} onPress={() => void clearCache()} />
        <ListRow
          icon="file-export-outline"
          title="Export records"
          subtitle="CSV of your records (link expires in 24 hours)"
          onPress={() => router.push('/settings/exports')}
        />
        <ListRow
          icon="shield-lock-outline"
          title="Privacy & data"
          subtitle="Retention, what is collected, delete account/workspace"
          onPress={() => router.push('/settings/privacy')}
        />
      </Group>

      <Group title="Account">
        <ListRow icon="bell-outline" title="Notifications" subtitle="Review, payment-phone, and scan-sync alerts" onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="account-cog-outline" title="Account & password" subtitle="Email, password, and sign-in security" onPress={() => router.push('/settings/account')} />
        {workspaces.length > 1 ? (
          <ListRow icon="swap-horizontal" title="Switch workspace" onPress={() => void selectWorkspace(null)} />
        ) : null}
        <ListRow icon="logout" title="Sign out" destructive onPress={() => void signOut()} />
      </Group>

      <Notice kind="info">
        PayTsek matches your records to notifications on your own phone. It does not verify payments with GCash, GoTyme or Maya and
        is not affiliated with them.
      </Notice>
      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayTsek {APP_VERSION}
      </Text>
    </Screen>
  );
}
