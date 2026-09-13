import type { RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { OfflineError } from '@/lib/api';
import { manilaTime, peso } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { downloadAndInstallUpdate, useAppUpdate } from '@/lib/release-update';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/theme';

type FeedItem =
  | { kind: 'local'; id: string; draft: Draft; at: string }
  | { kind: 'remote'; id: string; record: RecordSummary; at: string };

function savedStatus(item: FeedItem) {
  if (item.kind === 'local') return { label: 'Receipt saved', icon: 'check', tone: 'saved' as const };
  switch (item.record.evidenceState) {
    case 'MATCHED_AUTO':
    case 'MATCHED_BY_USER':
      return { label: 'Notification matched', icon: 'check', tone: 'matched' as const };
    case 'CONFIRMED_MANUALLY':
      return { label: 'Confirmed manually', icon: 'check', tone: 'matched' as const };
    case 'REVIEW_REQUIRED':
      return { label: 'Needs review', icon: 'alert-outline', tone: 'review' as const };
    case 'VOIDED':
      return { label: 'Voided', icon: 'close', tone: 'muted' as const };
    default:
      return { label: 'Receipt saved', icon: 'check', tone: 'saved' as const };
  }
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ savedAmount?: string }>();
  const { workspace } = useSession();
  const home = useHome();
  const update = useAppUpdate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);

  useFocusEffect(useCallback(() => {
    refreshLocal();
  }, [refreshLocal, home.dataUpdatedAt]));

  const remote = home.data?.recentRecords ?? [];
  const remoteIds = new Set(remote.map((record) => record.id));
  const feed: FeedItem[] = [
    ...drafts
      .filter((draft) => !draft.serverRecordId || !remoteIds.has(draft.serverRecordId))
      .map((draft): FeedItem => ({ kind: 'local', id: draft.clientRecordId, draft, at: draft.createdAt })),
    ...remote.map((record): FeedItem => ({ kind: 'remote', id: record.id, record, at: record.createdAt })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);

  const savedAmount = Number(params.savedAmount);
  const justSaved = Number.isFinite(savedAmount) && savedAmount > 0;
  const offline = home.error instanceof OfflineError;
  const refreshing = home.isRefetching;
  const refresh = () => {
    refreshLocal();
    void home.refetch();
  };
  const installUpdate = useCallback(() => {
    if (!update.data || updateProgress !== null) return;
    setUpdateProgress(0);
    void downloadAndInstallUpdate(update.data, setUpdateProgress)
      .catch((error: unknown) => {
        Alert.alert('Update could not start', error instanceof Error ? error.message : 'Please try again.');
      })
      .finally(() => setUpdateProgress(null));
  }, [update.data, updateProgress]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE, gap: SPACING.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.header}>
          <View style={{ gap: 4 }}>
            <Text variant="headlineMedium" style={styles.heading}>{greeting()}</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>Scan payment proofs and we’ll save them</Text>
          </View>
          <IconButton icon="account-circle-outline" size={28} onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Open settings" />
        </View>

        {justSaved ? (
          <View style={[styles.saved, { backgroundColor: theme.colors.secondaryContainer }]} accessibilityRole="alert">
            <View style={[styles.savedIcon, { backgroundColor: theme.colors.secondary }]}>
              <Icon source="check" size={24} color={theme.colors.onSecondary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>{peso(savedAmount)} saved</Text>
            </View>
          </View>
        ) : null}

        {update.data ? (
          <TouchableRipple onPress={installUpdate} disabled={updateProgress !== null} borderless style={{ borderRadius: RADIUS.lg }} accessibilityRole="button" accessibilityLabel={`Update to PayTsek ${update.data.version}`}>
            <View style={[styles.update, { backgroundColor: theme.colors.primaryContainer }]}>
              <View style={[styles.updateIcon, { backgroundColor: theme.colors.primary }]}><Icon source="download" size={20} color={theme.colors.onPrimary} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>PayTsek {update.data.version} is ready</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                  {updateProgress === null ? 'Tap to download and install the latest signed update.' : `Downloading update ${Math.round(updateProgress * 100)}%`}
                </Text>
              </View>
              <Icon source="chevron-right" size={22} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        ) : null}

        <Button
          mode="contained"
          icon="line-scan"
          contentStyle={{ minHeight: 58 }}
          labelStyle={{ fontSize: 16, fontWeight: '700' }}
          style={{ borderRadius: RADIUS.xl }}
          onPress={() => router.push('/(tabs)/scan')}
        >
          Scan proof
        </Button>

        {offline ? (
          <View style={styles.compactStatus} accessibilityRole="alert">
            <Icon source="cloud-off-outline" size={18} color={theme.colors.tertiary} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Offline</Text>
          </View>
        ) : null}

        {(home.data?.today.reviewRequiredCount ?? 0) > 0 ? (
          <TouchableRipple onPress={() => router.push('/(tabs)/review')} borderless style={{ borderRadius: RADIUS.lg }}>
            <View style={[styles.attention, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <Icon source="alert-outline" size={21} color={theme.colors.onTertiaryContainer} />
              <Text variant="titleSmall" style={{ flex: 1, color: theme.colors.onTertiaryContainer }}>Needs attention</Text>
              <Text variant="labelLarge" style={{ color: theme.colors.onTertiaryContainer }}>{home.data!.today.reviewRequiredCount}</Text>
              <Icon source="chevron-right" size={20} color={theme.colors.onTertiaryContainer} />
            </View>
          </TouchableRipple>
        ) : null}

        <View style={{ gap: SPACING.sm }}>
          <View style={styles.sectionHeading}>
            <Text variant="headlineSmall" style={{ fontWeight: '700' }}>Today</Text>
            <Button compact onPress={() => router.push('/(tabs)/records')}>Records</Button>
          </View>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>Recent payments</Text>

          {home.isLoading && feed.length === 0 ? <Loading variant="list" label="Loading records" /> : null}
          {!home.isLoading && feed.length === 0 ? (
            <View style={[styles.empty, { borderColor: theme.colors.outlineVariant }]}>
              <Icon source="receipt-text-outline" size={28} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Your saved payment proofs will appear here.</Text>
            </View>
          ) : null}

          {feed.length ? (
            <View style={[styles.list, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
              {feed.map((item, index) => {
                const amount = item.kind === 'local' ? item.draft.request.corrected.amountCentavos : item.record.amountCentavos;
                const reference = item.kind === 'local' ? item.draft.request.corrected.referenceValue : item.record.referenceValue;
                const source = item.kind === 'local' ? (item.draft.request.corrected.receiptProvider ?? 'Payment') : item.record.sourceLabel;
                return (
                  <TouchableRipple
                    key={`${item.kind}.${item.id}`}
                    onPress={item.kind === 'remote' ? () => router.push(`/record/${item.record.id}`) : undefined}
                    disabled={item.kind === 'local'}
                  >
                    <View style={[styles.row, index > 0 && { borderTopColor: theme.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <View style={[styles.providerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                        <Icon source="wallet-outline" size={24} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>{peso(amount)}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                          {source}{reference ? ` · ${reference.slice(-6)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: SPACING.xs }}>
                        <View style={[
                          styles.statusPill,
                          savedStatus(item).tone === 'review' && { backgroundColor: theme.colors.tertiaryContainer },
                          savedStatus(item).tone === 'muted' && { backgroundColor: theme.colors.surfaceVariant },
                          (savedStatus(item).tone === 'saved' || savedStatus(item).tone === 'matched') && { backgroundColor: '#0B463D' },
                        ]}>
                          <Icon
                            source={savedStatus(item).icon}
                            size={16}
                            color={savedStatus(item).tone === 'review' ? theme.colors.onTertiaryContainer : savedStatus(item).tone === 'muted' ? theme.colors.onSurfaceVariant : '#86E7C6'}
                          />
                          <Text variant="labelSmall" style={{ color: savedStatus(item).tone === 'review' ? theme.colors.onTertiaryContainer : savedStatus(item).tone === 'muted' ? theme.colors.onSurfaceVariant : '#86E7C6', fontWeight: '700' }}>
                            {savedStatus(item).label}
                          </Text>
                        </View>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(item.at)}</Text>
                      </View>
                    </View>
                  </TouchableRipple>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  heading: { fontWeight: '700', letterSpacing: -0.8 },
  saved: { minHeight: 88, borderRadius: RADIUS.xl, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  savedIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  update: { minHeight: 72, paddingHorizontal: SPACING.md, borderRadius: RADIUS.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  updateIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactStatus: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  attention: { minHeight: 60, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionHeading: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 96, marginHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  providerIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  statusPill: { minHeight: 30, borderRadius: 16, paddingHorizontal: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { minHeight: 112, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
});
