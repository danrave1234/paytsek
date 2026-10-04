import type { ExportJobView } from '@paytsek/contracts';
import React, { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useExportJob } from '@/lib/queries';
import { manilaTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
];

/** Milliseconds elapsed since midnight in the workspace timezone. */
function elapsedSinceMidnight(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (((get('hour') % 24) * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds();
}

export default function Exports() {
  const theme = useTheme();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
  const [requested, setRequested] = useState<ExportJobView | null>(null);
  const query = useExportJob(requested?.id);
  const job = query.data ?? requested;
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (days: number) => {
    if (creating || job?.status === 'PENDING' || job?.status === 'RUNNING') return;
    setCreating(true);
    setError(null);
    const to = new Date();
    const from = new Date(to);
    if (days === 0) from.setTime(to.getTime() - elapsedSinceMidnight(to, timezone));
    else from.setDate(from.getDate() - days);
    try {
      setRequested(await api<ExportJobView>('/v1/exports', {
        method: 'POST',
        body: { format: 'CSV', from: from.toISOString(), to: to.toISOString(), includeVoided: false },
      }));
    } catch (createError) {
      setError((createError as Error).message);
    } finally { setCreating(false); }
  };

  const preparing = job?.status === 'PENDING' || job?.status === 'RUNNING';
  return (
    <Screen>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Exports contain payment records and evidence status. Download links expire after 24 hours.
      </Text>
      <Group title="Date range">
        {RANGES.map((range) => (
            <ListRow key={range.key} icon="calendar-range" title={range.label} subtitle="CSV" onPress={creating || preparing ? undefined : () => void create(range.days)} />
        ))}
      </Group>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {query.error ? <Notice kind="warning">Could not refresh the export. Your request is retained; check its status when connected.</Notice> : null}
      {creating ? <ActivityIndicator accessibilityLabel="Requesting export" /> : null}

      {job ? (
        <View style={[styles.status, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]} accessibilityLiveRegion="polite">
          <View style={styles.statusHeader}>
            {preparing ? <ActivityIndicator size={22} /> : <Icon source={job.status === 'READY' ? 'file-check-outline' : 'file-alert-outline'} size={24} color={job.status === 'READY' ? theme.colors.primary : theme.colors.error} />}
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall">{preparing ? 'Preparing export' : job.status === 'READY' ? 'Export ready' : job.status === 'EXPIRED' ? 'Export expired' : 'Export failed'}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Requested {manilaTime(job.createdAt, undefined, timezone)}</Text>
            </View>
          </View>
          {job.rowCount !== null ? <Row label="Records" value={String(job.rowCount)} /> : null}
          {job.expiresAt && job.status === 'READY' ? <Row label="Link expires" value={manilaTime(job.expiresAt, undefined, timezone)} /> : null}
          {job.status === 'FAILED' ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>Try creating the export again.</Text> : null}
          {preparing || query.error ? <Button icon="refresh" disabled={query.isFetching} loading={query.isFetching} onPress={() => void query.refetch()} contentStyle={{ minHeight: TOUCH_TARGET }}>Check export status</Button> : null}
          {job.downloadUrl && job.status === 'READY' ? <>
            <Button mode="contained" icon="download" onPress={() => void Linking.openURL(job.downloadUrl!).catch(() => setError('Could not open the download. Try sharing the link.'))} contentStyle={{ minHeight: TOUCH_TARGET }}>Download CSV</Button>
            <Button icon="share-variant" onPress={() => void Share.share({ message: job.downloadUrl!, title: 'PayTsek records CSV' }).catch(() => setError('Could not open sharing. Try downloading the CSV.'))} contentStyle={{ minHeight: TOUCH_TARGET }}>Share download link</Button>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Anyone with this link can download the CSV until it expires. Share only with people who should have access.</Text>
          </> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
