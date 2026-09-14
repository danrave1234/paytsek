import type { ExportJobView } from '@paytsek/contracts';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Row, Screen } from '@/components/ui';
import { api, isApiError } from '@/lib/api';
import { manilaTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
];

// A stuck export must not poll forever: ~2 minutes at 2.5s per attempt.
const MAX_POLL_ATTEMPTS = 48;

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
  const [job, setJob] = useState<ExportJobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollAttempts = useRef(0);

  useEffect(() => {
    if (!job || ['READY', 'FAILED', 'EXPIRED'].includes(job.status)) return;
    const timer = setInterval(async () => {
      pollAttempts.current += 1;
      if (pollAttempts.current > MAX_POLL_ATTEMPTS) {
        setJob({ ...job, status: 'FAILED' });
        setError('The export is taking too long. Try creating it again.');
        return;
      }
      try {
        setJob(await api<ExportJobView>(`/v1/exports/${job.id}`));
      } catch (pollError) {
        if (isApiError(pollError, 'EXPORT_EXPIRED')) setJob({ ...job, status: 'EXPIRED' });
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [job]);

  const create = async (days: number) => {
    setError(null);
    pollAttempts.current = 0;
    const to = new Date();
    const from = new Date(to);
    if (days === 0) from.setTime(to.getTime() - elapsedSinceMidnight(to, timezone));
    else from.setDate(from.getDate() - days);
    try {
      setJob(await api<ExportJobView>('/v1/exports', {
        method: 'POST',
        body: { format: 'CSV', from: from.toISOString(), to: to.toISOString(), includeVoided: false },
      }));
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  const preparing = job?.status === 'PENDING' || job?.status === 'RUNNING';
  return (
    <Screen>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Exports contain payment records and evidence status. Download links expire after 24 hours.
      </Text>
      <Group title="Date range">
        {RANGES.map((range) => (
          <ListRow key={range.key} icon="calendar-range" title={range.label} subtitle="CSV" onPress={() => void create(range.days)} />
        ))}
      </Group>
      {error ? <Notice kind="error">{error}</Notice> : null}

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
          {job.downloadUrl ? <Button mode="contained" icon="download" onPress={() => void Linking.openURL(job.downloadUrl!)} style={{ minHeight: TOUCH_TARGET }}>Download CSV</Button> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
