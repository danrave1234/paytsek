import {
  PROVIDERS,
  PROVIDER_LABELS,
  type CreatePairingSessionResponse,
  type DeviceSummary,
  type Provider,
  type SourceSummary,
} from '@paytsek/contracts';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Portal, RadioButton, Snackbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { Group, Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useDevices, useSources } from '@/lib/queries';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

export default function ConnectAnotherPhone() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const sources = useSources();
  const devices = useDevices();
  const [provider, setProvider] = useState<Provider>('GCASH');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<CreatePairingSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const selected = useMemo(
    () => sources.data?.find((source) => source.provider === provider),
    [provider, sources.data],
  );

  useEffect(() => {
    if (!session) return;
    const update = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(session.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = setInterval(() => {
      update();
      void devices.refetch();
    }, 3000);
    return () => clearInterval(timer);
  }, [session, devices.refetch]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let source = selected;
      if (!source) {
        source = await api<SourceSummary>('/v1/sources', {
          method: 'POST',
          body: {
            provider,
            label: PROVIDER_LABELS[provider],
            declaredIdentifier: `separate-phone:${provider}`,
            maskedDisplay: 'Separate payment phone',
            recipientAliases: [],
            isDefault: (sources.data?.length ?? 0) === 0,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      const result = await api<CreatePairingSessionResponse>('/v1/pairing', {
        method: 'POST',
        body: { sourceId: source.id, requestedCapability: 'COLLECTOR', deviceLabel: 'Payment phone' },
      });
      setSession(result);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pendingDevices = (devices.data ?? []).filter(
    (device) => device.status === 'PAUSED' && device.boundSourceIds.length === 0 && device.capability !== 'SCANNER',
  );

  const approve = async (device: DeviceSummary, approved: boolean) => {
    if (!session) return;
    try {
      await api('/v1/pairing/approve', {
        method: 'POST',
        body: { pairingSessionId: session.pairingSessionId, approve: approved },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices'] }),
        queryClient.invalidateQueries({ queryKey: ['sources'] }),
      ]);
      setToast(approved ? 'Payment phone connected' : 'Connection rejected');
      setSession(null);
    } catch (approvalError) {
      setError((approvalError as Error).message);
    }
  };

  return (
    <Screen>
      <View style={styles.intro}>
        <Text variant="titleMedium" style={styles.title}>Which wallet is on the other phone?</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Use this only when the wallet notifications arrive on a different Android phone.
        </Text>
      </View>

      <Group title="Wallet app">
        {PROVIDERS.map((item) => {
          const activeElsewhere = sources.data?.find((source) => source.provider === item.value)?.activeCollectorDeviceId;
          const selectedProvider = provider === item.value;
          return (
            <TouchableRipple
              key={item.value}
              onPress={() => { setProvider(item.value); setSession(null); setError(null); }}
              disabled={Boolean(activeElsewhere) || busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedProvider, disabled: Boolean(activeElsewhere) || busy }}
            >
              <View style={styles.walletRow}>
                <ProviderLogo provider={item.value} size={38} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge">{item.label}</Text>
                  {activeElsewhere ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Already connected</Text> : null}
                </View>
                <RadioButton.Android value={item.value} status={selectedProvider ? 'checked' : 'unchecked'} disabled={Boolean(activeElsewhere) || busy} />
              </View>
            </TouchableRipple>
          );
        })}
      </Group>

      {selected?.activeCollectorDeviceId ? (
        <Notice kind="warning">This wallet already has a payment phone. Disconnect it under Connected devices first.</Notice>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}

      {!session ? (
        <Button
          mode="contained"
          icon="link-variant"
          loading={busy}
          disabled={busy || Boolean(selected?.activeCollectorDeviceId)}
          onPress={() => void create()}
          style={styles.action}
        >
          Get connection code
        </Button>
      ) : (
        <View style={[styles.codePanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>ENTER ON THE OTHER PHONE</Text>
          <Text
            variant="displaySmall"
            selectable
            accessibilityLabel={`Connection code ${session.code.split('').join(' ')}`}
            style={styles.code}
          >
            {session.code}
          </Text>
          <Text variant="bodySmall" style={{ color: secondsLeft ? theme.colors.onSurfaceVariant : theme.colors.error }}>
            {secondsLeft ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Code expired'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            Open PayTsek on the payment phone, choose “Join as payment phone,” then enter this code.
          </Text>
        </View>
      )}

      {session && pendingDevices.length > 0 ? (
        <Group title="Approval">
          {pendingDevices.map((device) => (
            <View key={device.id} style={styles.approvalRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyLarge">{device.label}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Android · PayTsek {device.appVersion ?? 'unknown'}</Text>
              </View>
              <Button compact onPress={() => void approve(device, false)}>Reject</Button>
              <Button compact mode="contained" onPress={() => void approve(device, true)}>Approve</Button>
            </View>
          ))}
        </Group>
      ) : null}

      <Portal><Snackbar visible={toast !== null} duration={3000} onDismiss={() => setToast(null)}>{toast}</Snackbar></Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 3, paddingVertical: SPACING.xs },
  title: { fontWeight: '700' },
  walletRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  action: { minHeight: TOUCH_TARGET },
  codePanel: { alignItems: 'center', gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: SPACING.xl },
  code: { fontWeight: '800', letterSpacing: 5, fontVariant: ['tabular-nums'] },
  approvalRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
});
