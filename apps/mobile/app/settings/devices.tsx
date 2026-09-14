import { PROVIDER_LABELS } from '@paytsek/contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { CollectorStatus } from 'payment-collector';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';
import { ErrorState, Group, ListRow, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { collectorStatus, getCollectorBinding, reportHealth } from '@/lib/collector';
import { lastSeen } from '@/lib/format';
import { useDevices } from '@/lib/queries';
import { useIsOwner } from '@/lib/session';
import { SPACING } from '@/theme';

export default function Devices() {
  const theme = useTheme();
  const query = useDevices();
  const queryClient = useQueryClient();
  const isOwner = useIsOwner();
  const [local, setLocal] = useState<CollectorStatus | null>(null);
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localCollecting = Boolean(local?.configured && local.enabledProviders.length > 0);
  const localReady = Boolean(localCollecting && local?.notificationAccessGranted && local.listenerConnected && !local.paused);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void Promise.all([collectorStatus(), getCollectorBinding()]).then(async ([status, binding]) => {
      setLocal(status);
      setLocalDeviceId(binding?.deviceId ?? null);
      await reportHealth();
      await query.refetch();
    });
    // Initial device health snapshot only; visible polling owns later refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED') => {
    setError(null);
    try {
      await api(`/v1/devices/${id}/status`, {
        method: 'POST',
        body: { status, reason: status === 'REVOKED' ? 'revoked by owner from Connected devices' : undefined },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices'] }),
        queryClient.invalidateQueries({ queryKey: ['sources'] }),
      ]);
    } catch (statusError) {
      setError((statusError as Error).message);
    }
  };

  const remoteDevices = (query.data ?? []).filter((device) => device.id !== localDeviceId);

  return (
    <Screen>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Health reflects PayTsek’s latest contact with a phone. It cannot guarantee that Android delivered every notification.
      </Text>

      {local?.supported ? (
        <Group title="This phone">
          <ListRow
            icon={localReady ? 'check-circle-outline' : localCollecting ? 'alert-circle-outline' : 'cellphone'}
            title={localReady ? 'Listening normally' : localCollecting ? 'Needs attention' : 'Not listening'}
            subtitle={local.enabledProviders.map((provider) => PROVIDER_LABELS[provider]).join(', ') || 'No wallet apps selected'}
          />
          {localCollecting ? (
            <View style={styles.details}>
              <Row label="Notification access" value={local.notificationAccessGranted ? 'Allowed' : 'Needed'} />
              <Row label="Android listener" value={local.listenerConnected ? 'Connected' : 'Disconnected'} />
              <Row label="Waiting to upload" value={String(local.pendingUploadCount)} />
              {local.lastUploadError ? <Row label="Last issue" value={local.lastUploadError} /> : null}
            </View>
          ) : null}
        </Group>
      ) : null}

      {error ? <Notice kind="error">{error}</Notice> : null}
      {query.isLoading ? <Loading variant="list" label="Loading connected devices" /> : null}
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {remoteDevices.map((device) => (
        <Group key={device.id} title={device.label}>
          <ListRow
            icon={device.status === 'ACTIVE' ? 'cellphone-check' : 'cellphone-alert'}
            title={device.status === 'ACTIVE' ? 'Connected' : device.status === 'PAUSED' ? 'Paused' : 'Disconnected'}
            subtitle={lastSeen(device.lastServerContactAt)}
          />
          <View style={styles.details}>
            <Row label="Use" value={device.capability === 'COLLECTOR' ? 'Wallet notifications' : device.capability === 'SCANNER' ? 'Scanning' : 'Scanning and notifications'} />
            {device.capability !== 'SCANNER' ? <Row label="Notification access" value={device.notificationAccessGranted ? 'Allowed' : 'Needed'} /> : null}
            <Row label="App" value={device.appVersion ? `PayTsek ${device.appVersion}` : 'Unknown version'} />
            {device.diagnosticReason ? <Row label="Issue" value={device.diagnosticReason} /> : null}
          </View>
          {isOwner && device.status !== 'REVOKED' ? (
            <View style={styles.actions}>
              <Button compact onPress={() => void setStatus(device.id, device.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}>
                {device.status === 'PAUSED' ? 'Resume' : 'Pause'}
              </Button>
              <Button compact textColor={theme.colors.error} onPress={() => void setStatus(device.id, 'REVOKED')}>Disconnect</Button>
            </View>
          ) : null}
        </Group>
      ))}

      {!query.isLoading && !local?.supported && remoteDevices.length === 0 ? (
        <View style={styles.empty}><Icon source="cellphone-off" size={30} color={theme.colors.onSurfaceVariant} /><Text variant="bodyMedium">No connected devices</Text></View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  details: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  actions: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACING.sm, paddingHorizontal: SPACING.md },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
});
