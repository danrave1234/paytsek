import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Screen, ScreenTitle } from '@/components/ui';
import { useIsOwner, useSession } from '@/lib/session';
import { useSources } from '@/lib/queries';
import { markOnboardingSeen } from '@/lib/onboarding';
import { api } from '@/lib/api';
import { getInstallId, platform, osVersion } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const owner = useIsOwner();
  const { session, workspace } = useSession();
  const sources = useSources();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async (scanner: boolean) => {
    if (!session || !workspace || busy) return;
    setBusy(true); setError(null);
    try {
      if (scanner) await api('/v1/devices/register-scanner', { method: 'POST', body: {
        deviceInstallId: await getInstallId(), platform, osVersion, appVersion: APP_VERSION,
        label: label.trim() || (owner ? 'Owner scanner' : 'Employee scanner'),
      } });
      await markOnboardingSeen(session.user.id, workspace.id);
      router.replace('/(tabs)/scan');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Screen>
    <ScreenTitle title="Set up your phones" subtitle={workspace?.name ?? 'One business. Two clear phone roles.'} />
    <Text variant="bodyLarge">The main phone receives the payment. Employee phones scan the customer’s receipt.</Text>
    <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
      <Card.Content style={{ gap: 12 }}>
        <Text variant="titleLarge">Main payment phone</Text>
        <Text>Use the Android phone with your receiving wallet or bank app. Only this phone needs notification access. Keep it connected to the internet.</Text>
        <Text variant="titleLarge">Employee / scanner phones</Text>
        <Text>Each employee joins your business with an invite and scans receipts on their own Android phone or iPhone. Wallet logins and notification access are not needed on scanner phones.</Text>
      </Card.Content>
    </Card>
    {owner ? <>
      <Group title="1 · Choose wallet notifications on the main phone">
        <ListRow icon="cellphone-message" title="Payment sources" subtitle={sources.data?.length ? `${sources.data.length} wallet source(s) added` : 'Choose the wallet apps used on the main payment phone'} onPress={() => router.push('/settings/sources')} />
      </Group>
      <Group title="2 · Connect the main Android phone">
        <ListRow icon="cellphone-link" title="Set up the main payment phone" subtitle="Choose a wallet source, then connect this Android phone or create a code for another phone." onPress={() => router.push('/pair')} />
        {Platform.OS === 'android' ? <ListRow icon="bell-outline" title="Already have a pairing code?" subtitle="Enter it on this main phone, accept sharing, and turn on Android notification access." onPress={() => router.push('/pair/collector')} /> : null}
        <ListRow icon="heart-pulse" title="Check main-phone connection" subtitle="Confirm notification access and listener health after pairing." onPress={() => router.push('/settings/devices')} />
      </Group>
      <Group title="3 · Add employee scanner phones">
        <ListRow icon="account-multiple-outline" title="Invite employees" subtitle="Send each employee an invite. They sign in on their own phone, join your workspace, and choose scanner setup." onPress={() => router.push('/settings/team')} />
      </Group>
      <Notice kind="info">This build pairs one wallet notification source per main phone. GCash matching is available for supported flows. Maya, GoTyme, and MariBank receipts can be recorded, but currently need manual confirmation.</Notice>
    </> : <Notice kind="info">You have joined as an employee. Your owner sets up the main payment phone and wallet sources. This phone only needs camera access when you take a photo; importing a screenshot also works.</Notice>}
    <View style={{ gap: 12, marginTop: 12 }}>
      <Text variant="titleMedium">Use this phone as a scanner</Text>
      <TextInput mode="outlined" label="Phone name (optional)" placeholder="e.g. Counter 1 · Ana" value={label} onChangeText={setLabel} maxLength={60} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button mode="contained" icon="line-scan" loading={busy} disabled={busy} contentStyle={{ minHeight: 52 }} onPress={() => void leave(true)}>Set up scanner and continue</Button>
      <Button disabled={busy} onPress={() => void leave(false)}>Finish later</Button>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Reopen this guide any time from More → Phone setup. Scanner availability depends on your plan.</Text>
    </View>
  </Screen>;
}
