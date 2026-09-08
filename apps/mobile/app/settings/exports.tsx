import type { ExportJobView } from '@payrecord/contracts';
import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';
import { api, isApiError } from '@/lib/api';
import { manilaTime } from '@/lib/format';
import { TOUCH_TARGET } from '@/theme';

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
];

export default function Exports() {
  const [job, setJob] = useState<ExportJobView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job || job.status === 'READY' || job.status === 'FAILED' || job.status === 'EXPIRED') return;
    const t = setInterval(async () => {
      try { setJob(await api<ExportJobView>(`/v1/exports/${job.id}`)); } catch (e) { if (isApiError(e, 'EXPORT_EXPIRED')) setJob({ ...job, status: 'EXPIRED' }); }
    }, 2500);
    return () => clearInterval(t);
  }, [job]);

  const create = async (days: number) => {
    setError(null);
    const to = new Date();
    const from = new Date(to);
    if (days === 0) from.setHours(0, 0, 0, 0); else from.setDate(from.getDate() - days);
    try { setJob(await api<ExportJobView>('/v1/exports', { method: 'POST', body: { format: 'CSV', from: from.toISOString(), to: to.toISOString(), includeVoided: false } })); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">Exports include your recorded payments with their evidence state. "Notification matched" is not a provider confirmation. Download links expire after 24 hours and the file is deleted.</Notice>
      {RANGES.map((r) => <Button key={r.key} mode="outlined" onPress={() => void create(r.days)} style={{ minHeight: TOUCH_TARGET }}>{r.label} (CSV)</Button>)}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {job ? (
        <Card mode="outlined">
          <Card.Title title={`Export ${job.status.toLowerCase()}`} subtitle={`Requested ${manilaTime(job.createdAt)}${job.rowCount !== null ? ` · ${job.rowCount} rows` : ''}`} />
          <Card.Content>
            {job.status === 'PENDING' || job.status === 'RUNNING' ? <Text variant="bodySmall">Preparing your file…</Text> : null}
            {job.status === 'FAILED' ? <Text variant="bodySmall">Failed ({job.errorCode}). Try again.</Text> : null}
            {job.status === 'EXPIRED' ? <Text variant="bodySmall">This export expired and was deleted.</Text> : null}
            {job.expiresAt && job.status === 'READY' ? <Text variant="bodySmall" style={{ opacity: 0.6 }}>Link valid until {manilaTime(job.expiresAt)}</Text> : null}
          </Card.Content>
          {job.downloadUrl ? <Card.Actions><Button mode="contained" onPress={() => void Linking.openURL(job.downloadUrl!)}>Download</Button></Card.Actions> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
