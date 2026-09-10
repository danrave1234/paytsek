import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import type { CollectorStatus } from 'payment-collector';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { collectorStatus, reportHealth } from '@/lib/collector';
import { lastSeen } from '@/lib/format';
import { useDevices } from '@/lib/queries';
import { useIsOwner } from '@/lib/session';

export default function Devices() {
  const theme = useTheme();
  const q = useDevices();
  const qc = useQueryClient();
  const isOwner = useIsOwner();
  const [local, setLocal] = useState<CollectorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') void collectorStatus().then(setLocal).then(() => reportHealth()).then(() => q.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED') => {
    try {
      await api(`/v1/devices/${id}/status`, { method: 'POST', body: { status, reason: status === 'REVOKED' ? 'revoked by owner from Devices screen' : undefined } });
      await qc.invalidateQueries({ queryKey: ['devices'] });
      await qc.invalidateQueries({ queryKey: ['sources'] });
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">"Last seen" shows the last time a phone contacted the server. Server silence does not prove the phone is off, and a recent heartbeat does not guarantee every notification is captured.</Notice>
      {local?.supported ? (
        <Card mode="outlined">
          <Card.Title title="This phone (local)" />
          <Card.Content>
            <Row label="Notification access" value={local.notificationAccessGranted ? 'Granted' : 'Not granted'} />
            <Row label="Listener connected" value={local.listenerConnected ? 'Yes' : 'No'} />
            <Row label="Pending uploads" value={String(local.pendingUploadCount)} />
            <Row label="Paused" value={local.paused ? 'Yes' : 'No'} />
            <Row label="Last upload error" value={local.lastUploadError ?? '—'} />
          </Card.Content>
        </Card>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : null}
      {q.data?.map((d) => (
        <Card key={d.id} mode="outlined">
          <Card.Title title={d.label} subtitle={`${d.platform} · ${d.capability.toLowerCase()} · ${d.status.toLowerCase()}`} />
          <Card.Content>
            <Row label="Server contact" value={lastSeen(d.lastServerContactAt)} />
            {d.capability !== 'SCANNER' ? (
              <>
                <Row label="Last event observed" value={d.lastObservedEventAt ? lastSeen(d.lastObservedEventAt) : 'None yet'} />
                <Row label="Pending uploads" value={d.pendingUploadCount === null ? '—' : String(d.pendingUploadCount)} />
                <Row label="Listener" value={d.listenerConnected === null ? '—' : d.listenerConnected ? 'Connected' : 'Disconnected'} />
                <Row label="Notification access" value={d.notificationAccessGranted === null ? '—' : d.notificationAccessGranted ? 'Granted' : 'Revoked'} />
                {d.diagnosticReason ? <Row label="Diagnostic" value={d.diagnosticReason} /> : null}
              </>
            ) : null}
            <Row label="App version" value={d.appVersion ?? '—'} />
          </Card.Content>
          {isOwner && d.status !== 'REVOKED' ? (
            <Card.Actions>
              <Button onPress={() => void setStatus(d.id, d.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}>{d.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button>
              <Button textColor={theme.colors.error} onPress={() => void setStatus(d.id, 'REVOKED')}>Revoke</Button>
            </Card.Actions>
          ) : null}
        </Card>
      ))}
      {q.data?.length === 0 ? <Text variant="bodyMedium">No devices registered yet.</Text> : null}
    </Screen>
  );
}
