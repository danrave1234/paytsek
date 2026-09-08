import { useRouter } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Group, ListRow, Notice, Screen, ScreenTitle } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { useIsOwner, useSession } from '@/lib/session';

export default function Settings() {
  const router = useRouter();
  const isOwner = useIsOwner();
  const { workspace, signOut, selectWorkspace, workspaces } = useSession();

  return (
    <Screen>
      <ScreenTitle
        title="Settings"
        subtitle={`${workspace?.name} · ${isOwner ? 'Owner' : 'Cashier'} · ${workspace?.planCode} plan`}
      />

      <Group title="This phone">
        {Platform.OS === 'android' ? (
          <ListRow
            icon="cellphone-message"
            title="Use this phone as the payment phone"
            subtitle="Read GCash notifications on this Android phone (requires owner code)"
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
            title="Receiving accounts"
            subtitle="GCash / GoTyme / Maya sources and aliases"
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
            subtitle="Records this month, prepaid credits, purchases"
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
        {workspaces.length > 1 ? (
          <ListRow icon="swap-horizontal" title="Switch workspace" onPress={() => void selectWorkspace(null)} />
        ) : null}
        <ListRow icon="logout" title="Sign out" destructive onPress={() => void signOut()} />
      </Group>

      <Notice kind="info">
        PayRecord matches your records to notifications on your own phone. It does not verify payments with GCash, GoTyme or Maya and
        is not affiliated with them.
      </Notice>
      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>
        PayRecord {APP_VERSION}
      </Text>
    </Screen>
  );
}
