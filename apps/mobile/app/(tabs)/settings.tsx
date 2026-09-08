import { useRouter } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';
import { APP_VERSION } from '@/lib/env';
import { useIsOwner, useSession } from '@/lib/session';

export default function Settings() {
  const router = useRouter();
  const isOwner = useIsOwner();
  const { workspace, signOut, selectWorkspace, workspaces } = useSession();

  return (
    <Screen>
      <Text variant="headlineSmall">Settings</Text>
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>{workspace?.name} · {isOwner ? 'Owner' : 'Cashier'} · {workspace?.planCode} plan</Text>

      <List.Section title="This phone">
        {Platform.OS === 'android' ? (
          <List.Item title="Use this phone as the payment phone" description="Read GCash notifications on this Android phone (requires owner code)" left={(p) => <List.Icon {...p} icon="cellphone-message" />} onPress={() => router.push('/pair/collector')} />
        ) : (
          <List.Item title="Payment notifications" description="iPhone cannot read other apps' notifications. Connect an Android phone or use manual confirmation." left={(p) => <List.Icon {...p} icon="information-outline" />} />
        )}
        <List.Item title="Devices & health" description="Last seen, pending uploads, notification access" left={(p) => <List.Icon {...p} icon="heart-pulse" />} onPress={() => router.push('/settings/devices')} />
      </List.Section>

      {isOwner ? (
        <List.Section title="Owner">
          <List.Item title="Connect an Android payment phone" description="Create a 5-minute pairing code" left={(p) => <List.Icon {...p} icon="qrcode" />} onPress={() => router.push('/pair')} />
          <List.Item title="Receiving accounts" description="GCash / GoTyme sources and aliases" left={(p) => <List.Icon {...p} icon="bank-outline" />} onPress={() => router.push('/settings/sources')} />
          <List.Item title="Incoming payments inbox" description="Unmatched notifications (owner only, 7-day retention)" left={(p) => <List.Icon {...p} icon="inbox-arrow-down-outline" />} onPress={() => router.push('/settings/inbox')} />
          <List.Item title="Team" description="Invite or remove cashiers" left={(p) => <List.Icon {...p} icon="account-multiple-outline" />} onPress={() => router.push('/settings/team')} />
          <List.Item title="Plan & usage" description="Records this month, prepaid credits, purchases" left={(p) => <List.Icon {...p} icon="credit-card-outline" />} onPress={() => router.push('/settings/billing')} />
        </List.Section>
      ) : null}

      <List.Section title="Data">
        <List.Item title="Export records" description="CSV of your records (link expires in 24 hours)" left={(p) => <List.Icon {...p} icon="file-export-outline" />} onPress={() => router.push('/settings/exports')} />
        <List.Item title="Privacy & data" description="Retention, what is collected, delete account/workspace" left={(p) => <List.Icon {...p} icon="shield-lock-outline" />} onPress={() => router.push('/settings/privacy')} />
      </List.Section>

      <Divider />
      {workspaces.length > 1 ? <List.Item title="Switch workspace" left={(p) => <List.Icon {...p} icon="swap-horizontal" />} onPress={() => void selectWorkspace(null)} /> : null}
      <List.Item title="Sign out" left={(p) => <List.Icon {...p} icon="logout" />} onPress={() => void signOut()} />
      <Notice kind="info">PayRecord matches your records to notifications on your own phone. It does not verify payments with GCash or GoTyme and is not affiliated with them.</Notice>
      <Text variant="bodySmall" style={{ opacity: 0.5, textAlign: 'center' }}>PayRecord {APP_VERSION}</Text>
    </Screen>
  );
}
