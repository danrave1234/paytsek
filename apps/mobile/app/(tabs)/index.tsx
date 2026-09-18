import { EVIDENCE_STATE_LABELS, PROVIDER_LABELS, type EvidenceState, type Provider, type RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Snackbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUpdateDialog } from '@/components/app-update-dialog';
import { AppearMotion, GrowBar, ValueChangeMotion } from '@/components/motion';
import { PaymentRecordRow } from '@/components/payment-record-row';
import { Loading, Notice } from '@/components/ui';
import { OfflineError } from '@/lib/api';
import { listDrafts, type Draft } from '@/lib/drafts';
import { draftOccurredAt, providerLabel, recordOccurredAt } from '@/lib/feed';
import { getFormatter, peso, workspaceDate } from '@/lib/format';
import { prefetchRecord, useDraftsSignal, useHome } from '@/lib/queries';
import { useAppUpdate } from '@/lib/release-update';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET, successColorFor } from '@/theme';

type FeedItem =
  | { kind: 'local'; id: string; draft: Draft; at: string; source: string; state: EvidenceState; amount: number; onPress: () => void; onPressIn?: () => void }
  | { kind: 'remote'; id: string; record: RecordSummary; at: string; source: string; state: EvidenceState; amount: number; onPress: () => void; onPressIn?: () => void };

function hourInZone(iso: string, timezone: string): number {
  const formatted = getFormatter('en-US', {
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
        {grouped.map((value, index) => {
          const barHeight = value > 0 ? Math.max(7, Math.round((value / max) * 58)) : 3;
          return (
            <View key={index} style={styles.barSlot}>
              <GrowBar height={barHeight} color={value > 0 ? theme.colors.primary : theme.colors.outlineVariant} />
            </View>
          );
        })}
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
  const params = useLocalSearchParams<{ savedAmount?: string; savedProvider?: string }>();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
  const home = useHome();
  const draftsSignal = useDraftsSignal();
  const update = useAppUpdate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [healthDismissed, setHealthDismissed] = useState(false);

  // Listening health: show a warning banner on Android when the collector is
  // configured but something is broken (no access, listener dead, or stale).
  const healthWarning = useMemo(() => {
    if (Platform.OS !== 'android') return null;
    const collectors = home.data?.collectors ?? [];
    const hasConfigured = collectors.some((c) => c.notificationAccessGranted !== null);
    if (!hasConfigured) return null;
    const hasAccess = collectors.some((c) => c.notificationAccessGranted);
    const isConnected = collectors.some((c) => !c.stale && c.lastSeenAt);
    if (!hasAccess) return 'Grant notification access in Settings to enable payment matching.';
    if (!isConnected) return 'Wallet listening stopped. Check permissions and battery settings.';
    return null;
  }, [home.data?.collectors]);

  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id, true).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);

  useFocusEffect(useCallback(() => {
    refreshLocal();
  }, [refreshLocal, draftsSignal]));

  const feed = useMemo<FeedItem[]>(() => {
    const local: FeedItem[] = drafts.map((draft) => ({
      kind: 'local',
      id: draft.clientRecordId,
      draft,
      at: draftOccurredAt(draft),
      source: providerLabel(draft.request.corrected.receiptProvider),
      state: 'UNVERIFIED',
      amount: draft.request.corrected.amountCentavos,
      onPress: () => router.push(`/record/local/${draft.clientRecordId}`),
    }));
    const remote: FeedItem[] = (home.data?.recentRecords ?? []).map((record) => ({
      kind: 'remote',
      id: record.id,
      record,
      at: recordOccurredAt(record),
      source: record.sourceLabel,
      state: record.evidenceState,
      amount: record.amountCentavos,
      onPress: () => router.push(`/record/${record.id}`),
      onPressIn: () => { void prefetchRecord(record.id); },
    }));
    return [...local, ...remote]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);
  }, [drafts, home.data?.recentRecords, router]);

  const { totalCentavos, recordCount, hourly } = useMemo(() => {
    const pendingCentavos = drafts.reduce((sum, draft) => sum + draft.request.corrected.amountCentavos, 0);
    const buckets = [...(home.data?.today.hourlyRecordedCentavos ?? Array.from({ length: 24 }, () => 0))];
    for (const draft of drafts) {
      const hour = hourInZone(draftOccurredAt(draft), timezone);
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) buckets[hour] = (buckets[hour] ?? 0) + draft.request.corrected.amountCentavos;
    }
    return {
      totalCentavos: (home.data?.today.recordedCentavos ?? 0) + pendingCentavos,
      recordCount: (home.data?.today.recordedCount ?? 0) + drafts.length,
      hourly: buckets,
    };
  }, [drafts, home.data, timezone]);

  // Day-close summary: evidence breakdown from server today counts + drafts
  const closeDaySummary = useMemo(() => {
    const today = home.data?.today;
    if (!today) return null;
    const evidence: Array<{ label: string; count: number; cents: number }> = [
      { label: 'Recorded', count: today.unverifiedCount, cents: today.unverifiedCentavos },
      { label: 'Possible match', count: today.notificationMatchedCount, cents: today.notificationMatchedCentavos },
      { label: 'Owner confirmed', count: today.confirmedManuallyCount, cents: today.confirmedManuallyCentavos },
    ];
    return { evidence, totalCents: totalCentavos, totalCount: recordCount };
  }, [home.data?.today, totalCentavos, recordCount]);

  useEffect(() => {
    const savedAmount = Number(params.savedAmount);
    if (!Number.isFinite(savedAmount) || savedAmount <= 0) return;
    const savedProvider = params.savedProvider as Provider | undefined;
    const providerLabel = savedProvider && Object.hasOwn(PROVIDER_LABELS, savedProvider)
      ? PROVIDER_LABELS[savedProvider]
      : null;
    setSavedToast(`${peso(savedAmount)}${providerLabel ? ` · ${providerLabel}` : ''} recorded`);
    // Route parameters outlive a render. Clear this one immediately so the
    // confirmation cannot stick around or replay after later navigation.
    router.setParams({ savedAmount: '', savedProvider: '' });
  }, [params.savedAmount, params.savedProvider, router]);
  const offline = home.error instanceof OfflineError;
  // Only a user-initiated pull shows the top spinner; the 30s background poll
  // must silently replace stale content without any visible loading indicator.
  const refresh = async () => {
    setRefreshing(true);
    try {
      refreshLocal();
      await home.refetch();
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
        <View style={styles.header}>
          <Image source={require('../../assets/paytsek-wordmark.png')} resizeMode="contain" accessibilityLabel="PayTsek" style={styles.wordmark} />
        </View>

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

        {healthWarning && !healthDismissed ? (
          <View style={[styles.inlineNotice, { backgroundColor: theme.colors.errorContainer }]}>
            <Icon source="alert-circle" size={19} color={theme.colors.onErrorContainer} />
            <Text variant="labelLarge" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
              {healthWarning}
            </Text>
            <TouchableRipple onPress={() => setHealthDismissed(true)} accessibilityRole="button">
              <View style={{ padding: 4 }}>
                <Icon source="close" size={18} color={theme.colors.onErrorContainer} />
              </View>
            </TouchableRipple>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {workspaceDate(new Date(), timezone)}
          </Text>
          <Text variant="headlineSmall" style={styles.heroTitle}>Recorded today</Text>
          <ValueChangeMotion value={totalCentavos}>
            <Text
              variant="displayMedium"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={styles.total}
            >
              {peso(totalCentavos)}
            </Text>
          </ValueChangeMotion>
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
          <TouchableRipple
            onPress={() => setShowCloseDay(true)}
            accessibilityRole="button"
            accessibilityLabel="Close day summary"
            style={[styles.closeDayBtn, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <View style={{ minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md }}>
              <Icon source="clipboard-list-outline" size={18} color={theme.colors.onSurfaceVariant} />
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>Close day</Text>
            </View>
          </TouchableRipple>
        </View>

        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Latest records</Text>
          <TouchableRipple onPress={() => router.navigate('/(tabs)/records')} borderless accessibilityRole="button">
            <View style={styles.viewAll}>
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>View all</Text>
              <Icon source="arrow-right" size={17} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        </View>

        {home.isLoading && feed.length === 0 ? <Loading variant="list" label="Loading records" /> : null}
        {!home.isLoading && feed.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>No payments recorded today.</Text>
        ) : null}

        <View>
          {feed.map((item, index) => (
            <AppearMotion itemKey={`${item.kind}.${item.id}`}>
              <PaymentRecordRow
                amountCentavos={item.amount}
                occurredAt={item.at}
                sourceLabel={item.source}
                state={item.state}
                timezone={timezone}
                divider={index > 0}
                onPress={item.onPress}
                onPressIn={item.onPressIn}
              />
            </AppearMotion>
          ))}
        </View>
      </ScrollView>
      <Snackbar
        visible={savedToast !== null}
        duration={3200}
        onDismiss={() => setSavedToast(null)}
        icon="check-circle-outline"
        onIconPress={() => setSavedToast(null)}
        style={{ marginBottom: TAB_BAR_CLEARANCE }}
        accessibilityLiveRegion="polite"
      >
        {savedToast}
      </Snackbar>
      <AppUpdateDialog update={update.data} visible={showUpdate} onDismiss={() => setShowUpdate(false)} />
      <Portal>
        <Dialog visible={showCloseDay} onDismiss={() => setShowCloseDay(false)}>
          <Dialog.Title>Today's summary</Dialog.Title>
          <Dialog.Content>
            {closeDaySummary ? (
              <View style={{ gap: SPACING.md }}>
                <View>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Total recorded</Text>
                  <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
                    {peso(closeDaySummary.totalCents)} · {closeDaySummary.totalCount} {closeDaySummary.totalCount === 1 ? 'record' : 'records'}
                  </Text>
                </View>
                <View style={{ gap: SPACING.sm }}>
                  {closeDaySummary.evidence.map((ev) => (
                    <View key={ev.label} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 24, alignItems: 'center' }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{ev.label}</Text>
                      <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                        {ev.count} · {peso(ev.cents)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>No data yet.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCloseDay(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  axis: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeader: { minHeight: 58, marginTop: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.2 },
  viewAll: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { minHeight: 72, textAlignVertical: 'center' },
  closeDayBtn: { marginTop: SPACING.md, borderRadius: RADIUS.md },
});
