import { EVIDENCE_STATE_LABELS, PROVIDER_LABELS, type AnalyticsRange, type AnalyticsSummary } from '@paytsek/contracts';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProviderLogo } from '@/components/provider-logo';
import { AppearMotion, ScreenEnter, useReducedMotion } from '@/components/motion';
import { CountUpText, FillBar } from '@/components/motion-effects';
import { RhythmChart } from '@/components/rhythm-chart';
import { ErrorState, Loading } from '@/components/ui';
import { peso } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { dailyBuckets, shortDay } from '@/lib/rhythm';
import { providerLabel } from '@/lib/feed';
import { useAnalytics } from '@/lib/queries';
import { RADIUS, SHADOW_COLOR, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET, stateColorsFor } from '@/theme';

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '90D', label: '90 days' },
];

/** Segmented period picker whose thumb slides to the chosen range. */
function RangeTabs({ value, onChange }: { value: AnalyticsRange; onChange: (value: AnalyticsRange) => void }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, RANGES.findIndex((item) => item.value === value));
  const position = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    if (reduced) { position.setValue(index); return; }
    const animation = Animated.spring(position, { toValue: index, damping: 20, stiffness: 260, mass: 0.7, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [index, position, reduced]);
  const segment = width / RANGES.length;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Analytics period"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      style={[styles.rangeBar, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rangeThumb,
            { width: segment, backgroundColor: theme.colors.surface, transform: [{ translateX: Animated.multiply(position, segment) }] },
          ]}
        />
      ) : null}
      {RANGES.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => { if (!selected) { haptics.select(); onChange(item.value); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.rangeButton}
          >
            <Text variant="labelLarge" style={{ color: selected ? theme.colors.primary : theme.colors.onSurfaceVariant }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Analytics() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<AnalyticsRange>('7D');
  const [refreshing, setRefreshing] = useState(false);
  const query = useAnalytics(range);
  const bars = useMemo(() => dailyBuckets(query.data?.daily ?? [], range), [query.data?.daily, range]);
  const rangeLabel = RANGES.find((item) => item.value === range)?.label ?? '';
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
        <RangeTabs value={range} onChange={setRange} />

        {query.isLoading ? <Loading variant="dashboard" label="Loading analytics" /> : null}
        {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
        {query.data ? (
          <ScreenEnter>
            <View style={styles.hero}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Recorded in this period</Text>
              <CountUpText value={query.data.recordedCentavos} format={peso} variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit style={styles.total} />
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
                <Text variant="titleMedium" numberOfLines={1} style={styles.metricValue}>{strongest ? providerLabel(strongest.provider) : '—'}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Top source</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{range === '90D' ? 'Weekly rhythm' : 'Daily rhythm'}</Text>
              <RhythmChart
                bars={bars}
                height={92}
                gap={range === '30D' ? 2 : 4}
                axis={[shortDay(query.data.from), shortDay(query.data.to)]}
                accessibilityLabel={`Recorded amount trend for ${rangeLabel}`}
                peakLabel={range === '90D' ? 'Best week' : 'Best day'}
                emptyLabel="No recorded payments in this period"
              />
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>By payment source</Text>
              {query.data.byProvider.length === 0 ? (
                <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No recorded payments in this period.</Text>
              ) : query.data.byProvider.map((item, index) => (
                <AppearMotion key={item.provider ?? 'UNKNOWN'} itemKey={`provider.${item.provider ?? 'UNKNOWN'}`} index={index}>
                  <View style={[styles.row, index > 0 && { borderTopColor: theme.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <ProviderLogo provider={item.provider} size={40} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text variant="titleSmall">{providerLabel(item.provider)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.recordedCount} {item.recordedCount === 1 ? 'record' : 'records'}</Text>
                      <FillBar
                        percent={query.data.recordedCentavos ? (item.recordedCentavos / query.data.recordedCentavos) * 100 : 0}
                        color={theme.colors.primary}
                        trackColor={theme.colors.surfaceVariant}
                        height={4}
                      />
                    </View>
                    <Text variant="titleMedium" style={styles.rowAmount}>{peso(item.recordedCentavos)}</Text>
                  </View>
                </AppearMotion>
              ))}
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>By evidence</Text>
              {query.data.byEvidence.map((item, index) => {
                const colors = stateColorsFor(theme.dark)[item.state];
                const share = query.data.recordedCentavos ? item.recordedCentavos / query.data.recordedCentavos * 100 : 0;
                const width = item.recordedCount > 0 ? Math.max(3, share) : 0;
                return (
                  <AppearMotion key={item.state} itemKey={`evidence.${item.state}`} index={index}>
                    <View style={styles.evidenceRow} accessible accessibilityLabel={`${EVIDENCE_STATE_LABELS[item.state]}: ${item.recordedCount} ${item.recordedCount === 1 ? 'record' : 'records'}, ${peso(item.recordedCentavos)}`}>
                      <View style={styles.evidenceLabels}>
                        <Icon source={colors.icon} size={16} color={colors.fg} />
                        <Text variant="bodyMedium" style={{ flex: 1 }}>{EVIDENCE_STATE_LABELS[item.state]}</Text>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>{item.recordedCount} · {peso(item.recordedCentavos)}</Text>
                      </View>
                      <FillBar percent={width} color={colors.fg} trackColor={theme.colors.surfaceVariant} />
                    </View>
                  </AppearMotion>
                );
              })}
            </View>
          </ScreenEnter>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  title: { fontWeight: '800', letterSpacing: -0.45 },
  rangeBar: { flexDirection: 'row', marginTop: SPACING.md, padding: 4, borderRadius: RADIUS.md },
  rangeThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: RADIUS.sm, shadowColor: SHADOW_COLOR, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  rangeButton: { flex: 1, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  hero: { paddingTop: SPACING.xl },
  total: { marginTop: 2, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  metrics: { flexDirection: 'row', marginTop: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: SPACING.sm },
  metricRule: { borderLeftWidth: StyleSheet.hairlineWidth },
  metricValue: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  section: { marginTop: SPACING.xl },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.2, marginBottom: SPACING.sm },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowAmount: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: SPACING.lg },
  evidenceRow: { gap: 7, paddingVertical: SPACING.sm },
  evidenceLabels: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
