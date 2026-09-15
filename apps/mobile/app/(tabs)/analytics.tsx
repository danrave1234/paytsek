import { EVIDENCE_STATE_LABELS, PROVIDER_LABELS, type AnalyticsRange, type AnalyticsSummary } from '@paytsek/contracts';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProviderLogo } from '@/components/provider-logo';
import { ErrorState, Loading } from '@/components/ui';
import { peso } from '@/lib/format';
import { useAnalytics } from '@/lib/queries';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET, stateColorsFor } from '@/theme';

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '90D', label: '90 days' },
];

function chartBuckets(data: AnalyticsSummary['daily'], range: AnalyticsRange) {
  if (range !== '90D') return data.map((day) => ({ amount: day.recordedCentavos, count: day.recordedCount }));
  const buckets: Array<{ amount: number; count: number }> = [];
  for (let index = 0; index < data.length; index += 7) {
    const week = data.slice(index, index + 7);
    buckets.push({
      amount: week.reduce((sum, day) => sum + day.recordedCentavos, 0),
      count: week.reduce((sum, day) => sum + day.recordedCount, 0),
    });
  }
  return buckets;
}

export default function Analytics() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<AnalyticsRange>('7D');
  const [refreshing, setRefreshing] = useState(false);
  const query = useAnalytics(range);
  const buckets = useMemo(() => chartBuckets(query.data?.daily ?? [], range), [query.data?.daily, range]);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.amount));
  const average = query.data?.daily.length ? Math.round(query.data.recordedCentavos / query.data.daily.length) : 0;
  const strongest = query.data?.byProvider[0] ?? null;

  // Only a user-initiated pull shows the top spinner; the background poll must
  // silently replace stale content without any visible loading indicator.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineSmall" style={styles.title}>Analytics</Text>
        <View accessibilityLabel="Analytics period" style={[styles.rangeBar, { backgroundColor: theme.colors.surfaceVariant }]}>
          {RANGES.map((item) => {
            const selected = item.value === range;
            return (
              <Pressable
                key={item.value}
                onPress={() => setRange(item.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.rangeButton, selected && { backgroundColor: theme.colors.surface }]}
              >
                <Text variant="labelLarge" style={{ color: selected ? theme.colors.primary : theme.colors.onSurfaceVariant }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {query.isLoading ? <Loading variant="dashboard" label="Loading analytics" /> : null}
        {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
        {query.data ? (
          <>
            <View style={styles.hero}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Recorded in this period</Text>
              <Text variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit style={styles.total}>{peso(query.data.recordedCentavos)}</Text>
            </View>

            <View style={[styles.metrics, { borderColor: theme.colors.outlineVariant }]}>
              <View style={styles.metric}>
                <Text variant="titleLarge" style={styles.metricValue}>{query.data.recordedCount}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Records</Text>
              </View>
              <View style={[styles.metric, styles.metricRule, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleLarge" numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{peso(average)}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Daily average</Text>
              </View>
              <View style={[styles.metric, styles.metricRule, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleMedium" numberOfLines={1} style={styles.metricValue}>{strongest ? PROVIDER_LABELS[strongest.provider] : '—'}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Top source</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{range === '90D' ? 'Weekly rhythm' : 'Daily rhythm'}</Text>
              <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`Recorded amount trend for ${RANGES.find((item) => item.value === range)?.label}`}>
                {buckets.map((bucket, index) => (
                  <View key={index} style={styles.barSlot}>
                    <View style={[styles.bar, { height: Math.max(4, Math.round((bucket.amount / max) * 92)), backgroundColor: bucket.amount ? theme.colors.primary : theme.colors.outlineVariant }]} />
                  </View>
                ))}
              </View>
              <View style={styles.axis}>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{query.data.from}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{query.data.to}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>By payment source</Text>
              {query.data.byProvider.length === 0 ? (
                <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No recorded payments in this period.</Text>
              ) : query.data.byProvider.map((item, index) => (
                <View key={item.provider} style={[styles.row, index > 0 && { borderTopColor: theme.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <ProviderLogo provider={item.provider} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall">{PROVIDER_LABELS[item.provider]}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.recordedCount} {item.recordedCount === 1 ? 'record' : 'records'}</Text>
                  </View>
                  <Text variant="titleMedium" style={styles.rowAmount}>{peso(item.recordedCentavos)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>By evidence</Text>
              {query.data.byEvidence.map((item) => {
                const colors = stateColorsFor(theme.dark)[item.state];
                const share = query.data.recordedCentavos ? item.recordedCentavos / query.data.recordedCentavos * 100 : 0;
                const width = item.recordedCount > 0 ? Math.max(3, share) : 0;
                return (
                  <View key={item.state} style={styles.evidenceRow}>
                    <View style={styles.evidenceLabels}>
                      <Text variant="bodyMedium">{EVIDENCE_STATE_LABELS[item.state]}</Text>
                      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{item.recordedCount}</Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <View style={[styles.fill, { width: `${width}%`, backgroundColor: colors.fg }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: '800', letterSpacing: -0.45 },
  rangeBar: { flexDirection: 'row', marginTop: SPACING.md, padding: 4, borderRadius: RADIUS.md },
  rangeButton: { flex: 1, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  hero: { paddingTop: SPACING.xl },
  total: { marginTop: 2, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  metrics: { flexDirection: 'row', marginTop: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: SPACING.sm },
  metricRule: { borderLeftWidth: StyleSheet.hairlineWidth },
  metricValue: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  section: { marginTop: SPACING.xl },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.2, marginBottom: SPACING.sm },
  chart: { height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barSlot: { flex: 1, height: 96, justifyContent: 'flex-end' },
  bar: { width: '100%', minWidth: 2, borderRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowAmount: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: SPACING.lg },
  evidenceRow: { gap: 7, paddingVertical: SPACING.sm },
  evidenceLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
});
