import {
  PROVIDERS,
  PROVIDER_LABELS,
  type ConfigureCurrentCollectorResponse,
  type Provider,
} from '@paytsek/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import { PaymentCollector, type CollectorStatus, type DetectedProviderApp } from 'payment-collector';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Portal, Snackbar, Switch, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { ErrorState, Group, ListRow, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { activateCollector, getCollectorBinding, type WalletProvider } from '@/lib/collector';
import { getInstallId, osVersion } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { keys, queryClient, useSources } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SPACING, TOUCH_TARGET } from '@/theme';

const EMPTY_STATUS: CollectorStatus = {
  supported: Platform.OS === 'android',
  configured: false,
  notificationAccessGranted: false,
  listenerConnected: false,
  enabledProviders: [],
  pendingUploadCount: 0,
  lastObservedEventAt: null,
  lastUploadAt: null,
  lastUploadError: null,
  unknownTemplateCount: 0,
  paused: false,
  appVersion: '',
  bootSessionId: '',
};

export default function WalletNotifications() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const sources = useSources();
  const [status, setStatus] = useState<CollectorStatus>(EMPTY_STATUS);
  const [apps, setApps] = useState<DetectedProviderApp[]>([]);
  const [enabled, setEnabled] = useState<WalletProvider[]>([]);
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshDevice = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const [nextStatus, detected, binding] = await Promise.all([
        PaymentCollector.getStatus(),
        PaymentCollector.detectProviderApps(),
        getCollectorBinding(),
      ]);
      setStatus(nextStatus);
      setApps(detected);
      const currentWorkspace = binding?.workspaceId === workspace?.id;
      setEnabled(currentWorkspace ? nextStatus.enabledProviders : []);
      setLocalDeviceId(currentWorkspace ? binding!.deviceId : null);
    } catch (loadError) {
      setError(loadError);
    }
  }, [workspace?.id]);

  useFocusEffect(useCallback(() => {
    void refreshDevice();
  }, [refreshDevice]));

  const serverByProvider = useMemo(
    () => new Map((sources.data ?? []).map((source) => [source.provider, source])),
    [sources.data],
  );

  const toggle = async (provider: Provider, value: boolean) => {
    if (!workspace || saving) return;
    const next = value
      ? [...new Set([...enabled, provider])]
      : enabled.filter((item) => item !== provider);
    const previous = enabled;
    setEnabled(next);
    setSaving(provider);
    setError(null);
    try {
      const installId = await getInstallId();
      const result = await api<ConfigureCurrentCollectorResponse>('/v1/devices/current/collector', {
        method: 'PUT',
        body: {
          deviceInstallId: installId,
          platform: 'ANDROID',
          appVersion: APP_VERSION,
          osVersion,
          providers: next,
          detectedProviderApps: apps.filter((app) => app.installed).map((app) => ({
            provider: app.provider,
            packageName: app.packageName,
            versionName: app.versionName ?? undefined,
            versionCode: app.versionCode ?? undefined,
            signingCertSha256: app.signingCertSha256 ?? undefined,
          })),
        },
      });
      await activateCollector({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        sourceLabel: next.length ? next.map((item) => PROVIDER_LABELS[item]).join(', ') : 'No wallet listeners',
        providers: result.providers,
        deviceId: result.deviceId,
        pairedAt: new Date().toISOString(),
      }, result.collectorCredential);
      await queryClient.invalidateQueries({ queryKey: keys.sources });
      const nextStatus = await PaymentCollector.getStatus();
      setStatus(nextStatus);
      setEnabled(result.providers);
      setLocalDeviceId(result.deviceId);
      setToast(value ? 'Listening turned on' : 'Listening turned off');
      if (value && !nextStatus.notificationAccessGranted) {
        PaymentCollector.openNotificationAccessSettings();
      }
    } catch (saveError) {
      setEnabled(previous);
      setError(saveError);
    } finally {
      setSaving(null);
    }
  };

  if (Platform.OS !== 'android') {
    return (
      <Screen>
        <Text variant="titleMedium">Use an Android phone</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          iOS does not allow apps to read notifications from wallet apps. Proof recording still works normally.
        </Text>
        <Button mode="contained-tonal" onPress={() => router.push('/pair')}>Connect an Android phone</Button>
      </Screen>
    );
  }

  if (sources.isLoading && !sources.data) return <Screen><Loading variant="list" label="Loading wallet apps" /></Screen>;
  if (sources.error && !sources.data) return <Screen><ErrorState error={sources.error} retry={() => void sources.refetch()} /></Screen>;

  return (
    <Screen>
      <View style={styles.intro}>
        <Text variant="titleMedium" style={styles.introTitle}>Listen on this phone</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          PayTsek keeps recognized incoming-payment notifications briefly, then compares them with new proofs.
        </Text>
      </View>

      {!status.notificationAccessGranted && enabled.length > 0 ? (
        <Group>
          <ListRow
            icon="bell-alert-outline"
            title="Allow notification access"
            subtitle="Required by Android to listen for the wallet apps below"
            onPress={() => PaymentCollector.openNotificationAccessSettings()}
          />
        </Group>
      ) : null}

      <Group title="Wallet apps">
        {PROVIDERS.map((item) => {
          const installed = apps.find((app) => app.provider === item.value)?.installed;
          const source = serverByProvider.get(item.value);
          const anotherPhone = Boolean(source?.activeCollectorDeviceId && source.activeCollectorDeviceId !== localDeviceId);
          const subtitle = anotherPhone
            ? 'Listening on another phone'
            : installed === false
              ? 'App not found on this phone'
              : enabled.includes(item.value)
                ? status.notificationAccessGranted ? 'Listening for incoming payments' : 'Waiting for Android access'
                : 'Off';
          return (
            <TouchableRipple
              key={item.value}
              onPress={() => void toggle(item.value, !enabled.includes(item.value))}
              disabled={saving !== null || anotherPhone}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled.includes(item.value), disabled: saving !== null || anotherPhone }}
            >
              <View style={styles.walletRow}>
                <ProviderLogo provider={item.value} size={40} />
                <View style={styles.walletCopy}>
                  <Text variant="bodyLarge">{item.label}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text>
                </View>
                <Switch value={enabled.includes(item.value)} disabled={saving !== null || anotherPhone} pointerEvents="none" />
              </View>
            </TouchableRipple>
          );
        })}
      </Group>

      {error ? (
        <View style={[styles.error, { backgroundColor: theme.colors.errorContainer }]} accessibilityRole="alert">
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
            {error instanceof Error ? error.message : 'Could not update notification listening.'}
          </Text>
          <Button compact onPress={() => setError(null)}>Dismiss</Button>
        </View>
      ) : null}

      <Group title="Another phone">
        <ListRow
          icon="cellphone-link"
          title="Connect a separate payment phone"
          subtitle="Optional for a phone that stays with the wallet owner"
          onPress={() => router.push('/pair')}
        />
      </Group>

      <Portal><Snackbar visible={toast !== null} duration={2600} onDismiss={() => setToast(null)}>{toast}</Snackbar></Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 3, paddingVertical: SPACING.xs },
  introTitle: { fontWeight: '700' },
  walletRow: {
    minHeight: TOUCH_TARGET + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  walletCopy: { flex: 1, gap: 2 },
  error: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md },
});
