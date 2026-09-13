import { PROVIDER_LABELS, type EvidenceState, type Provider, type RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUpdateDialog } from '@/components/app-update-dialog';
import { PaymentRecordRow } from '@/components/payment-record-row';
import { Loading } from '@/components/ui';
import { OfflineError } from '@/lib/api';
import { listDrafts, type Draft } from '@/lib/drafts';
import { peso, workspaceDate } from '@/lib/format';
import { prefetchRecord, useHome } from '@/lib/queries';
import { useAppUpdate } from '@/lib/release-update';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/theme';

type FeedItem =
  | { kind: 'local'; id: string; draft: Draft; at: string; source: string; state: EvidenceState; amount: number }
  | { kind: 'remote'; id: string; record: RecordSummary; at: string; source: string; state: EvidenceState; amount: number };

function localProvider(provider: Provider | null | undefined): string {
  return provider ? PROVIDER_LABELS[provider] : 'Payment';
}

function localOccurredAt(draft: Draft): string {
  return draft.request.corrected.receiptTransactionAt ?? draft.request.capturedAt ?? draft.createdAt;
}

function remoteOccurredAt(record: RecordSummary): string {
  return record.receiptTransactionAt ?? record.capturedAt ?? record.createdAt;
}

function hourInZone(iso: string, timezone: string): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(new Date(iso));
  const parsed = Number(formatted);
  return parsed === 24 ? 0 : parsed;
}

function HourlyRhythm({ values }: { values: number[] }) {
  const theme = useTheme();
  const grouped = Array.from({ length: 12 }, (_, index) => (values[index * 2] ?? 0) + (values[index * 2 + 1] ?? 0));
  const max = Math.max(...grouped, 1);
  return (
    <View accessible accessibilityLabel="Recorded amount by time of day" style={styles.rhythm}>
      <View style={styles.bars} importantForAccessibility="no-hide-descendants">
        {grouped.map((value, index) => (
          <View key={index} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: value > 0 ? Math.max(7, Math.round((value / max) * 58)) : 3,
                  backgroundColor: value > 0 ? theme.colors.primary : theme.colors.outlineVariant,
                  opacity: value > 0 ? 0.82 : 0.7,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants">
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>12 AM</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>6 AM</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>12 PM</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>6 PM</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>11 PM</Text>
      </View>
    </View>
  );
}

export default function Today() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ savedAmount?: string }>();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
  const home = useHome();
  const update = useAppUpdate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showUpdate, setShowUpdate] = useState(false);

  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id, true).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);

  useFocusEffect(useCallback(() => {
    refreshLocal();
  }, [refreshLocal, home.dataUpdatedAt]));

  const feed = useMemo<FeedItem[]>(() => {
    const local: FeedItem[] = drafts.map((draft) => ({
      kind: 'local',
      id: draft.clientRecordId,
      draft,
      at: localOccurredAt(draft),
      source: localProvider(draft.request.corrected.receiptProvider),
      state: 'UNVERIFIED',
      amount: draft.request.corrected.amountCentavos,
    }));
    const remote: FeedItem[] = (home.data?.recentRecords ?? []).map((record) => ({
      kind: 'remote',
      id: record.id,
      record,
      at: remoteOccurredAt(record),
      source: record.sourceLabel,
      state: record.evidenceState,
      amount: record.amountCentavos,
    }));
    return [...local, ...remote]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);
  }, [drafts, home.data?.recentRecords]);

  const pendingCentavos = drafts.reduce((sum, draft) => sum + draft.request.corrected.amountCentavos, 0);
  const totalCentavos = (home.data?.today.recordedCentavos ?? 0) + pendingCentavos;
  const recordCount = (home.data?.today.recordedCount ?? 0) + drafts.length;
  const hourly = [...(home.data?.today.hourlyRecordedCentavos ?? Array.from({ length: 24 }, () => 0))];
  for (const draft of drafts) {
    const hour = hourInZone(localOccurredAt(draft), timezone);
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) hourly[hour] = (hourly[hour] ?? 0) + draft.request.corrected.amountCentavos;
  }

  const savedAmount = Number(params.savedAmount);
  const justSaved = Number.isFinite(savedAmount) && savedAmount > 0;
  const offline = home.error instanceof OfflineError;
  const refresh = () => {
    refreshLocal();
    void home.refetch();
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={refresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/paytsek-wordmark.png')} resizeMode="contain" accessibilityLabel="PayTsek" style={styles.wordmark} />
        </View>

        {justSaved ? (
          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.secondaryContainer }]} accessibilityRole="alert">
            <Icon source="check-circle" size={19} color={theme.colors.primary} />
            <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>{peso(savedAmount)} recorded</Text>
          </View>
        ) : null}

        {update.data ? (
          <TouchableRipple onPress={() => setShowUpdate(true)} accessibilityRole="button">
            <View style={[styles.inlineNotice, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="download" size={19} color={theme.colors.primary} />
              <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}>
                PayTsek {update.data.version} is ready
              </Text>
              <Icon source="chevron-right" size={18} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        ) : null}

        <View style={styles.hero}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {workspaceDate(new Date(), timezone)}
          </Text>
          <Text variant="headlineSmall" style={styles.heroTitle}>Recorded today</Text>
          <Text
            variant="displayMedium"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={styles.total}
          >
            {peso(totalCentavos)}
          </Text>
          <View style={styles.countRow}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {recordCount} {recordCount === 1 ? 'record' : 'records'}
            </Text>
            {offline ? (
              <View style={styles.offline} accessibilityRole="alert">
                <Icon source="cloud-off-outline" size={15} color={theme.colors.tertiary} />
                <Text variant="labelSmall" style={{ color: theme.colors.tertiary }}>Offline</Text>
              </View>
            ) : null}
          </View>
          <HourlyRhythm values={hourly} />
        </View>

        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Latest records</Text>
          <TouchableRipple onPress={() => router.push('/(tabs)/records')} borderless accessibilityRole="button">
            <View style={styles.viewAll}>
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>View all</Text>
              <Icon source="arrow-right" size={17} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        </View>

        {home.isLoading && feed.length === 0 ? <Loading variant="list" label="Loading records" /> : null}
        {!home.isLoading && feed.length === 0 ? (
          <TouchableRipple onPress={() => router.push('/(tabs)/scan')} borderless accessibilityRole="button">
            <View style={styles.empty}>
              <Icon source="qrcode-scan" size={26} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ fontWeight: '700' }}>Record your first payment</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Scan a proof or import a screenshot.</Text>
              </View>
              <Icon source="arrow-right" size={20} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        ) : null}

        <View>
          {feed.map((item, index) => (
            <PaymentRecordRow
              key={`${item.kind}.${item.id}`}
              amountCentavos={item.amount}
              occurredAt={item.at}
              sourceLabel={item.source}
              state={item.state}
              timezone={timezone}
              divider={index > 0}
              onPress={item.kind === 'remote' ? () => router.push(`/record/${item.record.id}`) : undefined}
              onPressIn={item.kind === 'remote' ? () => { void prefetchRecord(item.record.id); } : undefined}
            />
          ))}
        </View>
      </ScrollView>
      <AppUpdateDialog update={update.data} visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  wordmark: { width: 142, height: 48 },
  inlineNotice: { minHeight: TOUCH_TARGET, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  hero: { paddingTop: SPACING.lg },
  heroTitle: { marginTop: SPACING.xs, fontWeight: '800', letterSpacing: -0.45 },
  total: { marginTop: 2, fontWeight: '800', letterSpacing: -1.45, fontVariant: ['tabular-nums'] },
  countRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rhythm: { marginTop: SPACING.lg },
  bars: { height: 62, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  barSlot: { flex: 1, height: 62, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  axis: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeader: { minHeight: 58, marginTop: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.2 },
  viewAll: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
