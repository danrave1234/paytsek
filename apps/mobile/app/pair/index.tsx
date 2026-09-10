import type { CreatePairingSessionResponse, DeviceSummary } from '@paytsek/contracts';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Menu, Text, TextInput } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useDevices, useSources } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { TOUCH_TARGET } from '@/theme';

/**
 * Owner flow: create a single-use 5-minute code, hand it to the Android
 * payment phone (any distance, any network), then approve the device here.
 */
export default function PairOwner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const sources = useSources();
  const devices = useDevices();
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [capability, setCapability] = useState<'COLLECTOR' | 'BOTH'>('COLLECTOR');
  const [label, setLabel] = useState('Payment phone');
  const [menu, setMenu] = useState(false);
  const [session, setSession] = useState<CreatePairingSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => { if (!sourceId && sources.data?.[0]) setSourceId(sources.data.find((s) => s.isDefault)?.id ?? sources.data[0].id); }, [sources.data, sourceId]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
      void devices.refetch();
    }, 3000);
    return () => clearInterval(t);
  }, [session, devices.refetch]);

  const create = async (thisPhone = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<CreatePairingSessionResponse>('/v1/pairing', { method: 'POST', body: { sourceId, requestedCapability: capability, deviceLabel: label } });
      setSession(result);
      setSecondsLeft(Math.max(0, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 1000)));
      if (thisPhone) router.push({ pathname: '/pair/collector', params: { c: result.code, ownerApproval: '1' } });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const pendingDevices = (devices.data ?? []).filter((d) => d.status === 'PAUSED' && d.boundSourceIds.length === 0 && (d.capability === 'COLLECTOR' || d.capability === 'BOTH'));

  const approve = async (d: DeviceSummary, ok: boolean) => {
    // The pairing session id is needed; the device accepted the current session.
    if (!session) return;
    try {
      await api('/v1/pairing/approve', { method: 'POST', body: { pairingSessionId: session.pairingSessionId, approve: ok } });
      await qc.invalidateQueries({ queryKey: ['devices'] });
      await qc.invalidateQueries({ queryKey: ['sources'] });
      if (ok) setSession(null);
    } catch (e) { setError((e as Error).message); }
  };

  const selected = sources.data?.find((s) => s.id === sourceId);

  return (
    <Screen>
      <Notice kind="info">
        The payment phone must be the Android phone that actually receives your {selected?.provider ?? 'wallet'} notifications. Pairing another phone does not forward notifications. The code never contains your login.
      </Notice>
      {sources.data?.length === 0 ? <Notice kind="warning">Add a wallet source first (Settings → Payment sources).</Notice> : null}
      <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Button mode="outlined" onPress={() => setMenu(true)} style={{ minHeight: TOUCH_TARGET }}>{selected ? `${selected.provider} notifications on main phone` : 'Choose payment source'}</Button>}>
        {sources.data?.map((s) => <Menu.Item key={s.id} title={`${s.provider} notifications on main phone`} onPress={() => { setSourceId(s.id); setMenu(false); }} />)}
      </Menu>
      {selected?.activeCollectorDeviceId ? <Notice kind="warning">This wallet source already has an active payment phone. Revoke it in Devices before pairing a different one.</Notice> : null}
      <TextInput label="Phone label" mode="outlined" value={label} onChangeText={setLabel} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode={capability === 'COLLECTOR' ? 'contained' : 'outlined'} onPress={() => setCapability('COLLECTOR')} style={{ flex: 1 }}>Collect only</Button>
        <Button mode={capability === 'BOTH' ? 'contained' : 'outlined'} onPress={() => setCapability('BOTH')} style={{ flex: 1 }}>Collect + scan</Button>
      </View>
      <Text variant="bodySmall" style={{ opacity: 0.7 }}>"Collect + scan" uses one scanner slot and one collector slot of your plan.</Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {Platform.OS === 'android' ? <Button mode="contained" icon="cellphone-check" loading={busy} onPress={() => void create(true)} disabled={busy || !sourceId || !!selected?.activeCollectorDeviceId} style={{ minHeight: TOUCH_TARGET }}>This is my main payment phone</Button> : null}
      <Button mode="outlined" onPress={() => void create()} disabled={busy || !sourceId || !!selected?.activeCollectorDeviceId} style={{ minHeight: TOUCH_TARGET }}>Create code for another main phone</Button>

      {session ? (
        <Card mode="outlined">
          <Card.Title title="Enter this code on the payment phone" subtitle={secondsLeft > 0 ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Expired — create a new code'} />
          <Card.Content style={{ alignItems: 'center', gap: 8 }}>
            <Text variant="displaySmall" selectable accessibilityLabel={`Pairing code ${session.code.split('').join(' ')}`} style={{ letterSpacing: 4 }}>{session.code}</Text>
            <Text variant="bodySmall" style={{ opacity: 0.7, textAlign: 'center' }}>On the main Android phone, open PayTsek → Set up main phone with a pairing code (on sign-in), or More → Set up this main payment phone. Enter the code, then approve it here.</Text>
          </Card.Content>
        </Card>
      ) : null}

      {session && pendingDevices.length ? (
        <Card mode="outlined">
          <Card.Title title="Waiting for your approval" />
          <Card.Content style={{ gap: 8 }}>
            {pendingDevices.map((d) => (
              <View key={d.id} style={{ gap: 4 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{d.label} · {d.platform} · app {d.appVersion ?? '?'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button mode="contained" onPress={() => void approve(d, true)} style={{ flex: 1 }}>Approve</Button>
                  <Button mode="outlined" onPress={() => void approve(d, false)} style={{ flex: 1 }}>Reject</Button>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}
