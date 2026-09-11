import type { RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useHome, useRecords } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { OfflineError } from '@/lib/api';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/theme';

type FeedItem =
  | { kind: 'local'; id: string; draft: Draft; at: string }
  | { kind: 'remote'; id: string; record: RecordSummary; at: string };

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
  const records = useRecords({});
  const home = useHome();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);

  useFocusEffect(useCallback(() => {
    refreshLocal();
  }, [refreshLocal, records.dataUpdatedAt]));

  const remote = records.data?.items ?? [];
  const remoteIds = new Set(remote.map((record) => record.id));
  const feed: FeedItem[] = [
    ...drafts
      .filter((draft) => !draft.serverRecordId || !remoteIds.has(draft.serverRecordId))
      .map((draft): FeedItem => ({ kind: 'local', id: draft.clientRecordId, draft, at: draft.createdAt })),
    ...remote.map((record): FeedItem => ({ kind: 'remote', id: record.id, record, at: record.createdAt })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);

  const savedAmount = Number(params.savedAmount);
  const justSaved = Number.isFinite(savedAmount) && savedAmount > 0;
  const offline = records.error instanceof OfflineError;
  const refreshing = records.isRefetching || home.isRefetching;
  const refresh = () => {
    refreshLocal();
    void Promise.all([records.refetch(), home.refetch()]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE, gap: SPACING.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.heading}>{greeting()}</Text>
          <IconButton icon="account-circle-outline" size={28} onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Open settings" />
        </View>

        {justSaved ? (
          <View style={[styles.saved, { backgroundColor: theme.colors.secondaryContainer }]} accessibilityRole="alert">
            <View style={[styles.savedIcon, { backgroundColor: theme.colors.secondary }]}>
              <Icon source="check" size={24} color={theme.colors.onSecondary} />
            </View>
            <Text variant="titleLarge" style={{ flex: 1, color: theme.colors.onSecondaryContainer }}>{peso(savedAmount)}</Text>
            <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>Recorded</Text>
          </View>
        ) : null}

        <Button
          mode="contained"
          icon="line-scan"
          contentStyle={{ minHeight: 58 }}
          labelStyle={{ fontSize: 16, fontWeight: '700' }}
          style={{ borderRadius: RADIUS.xl }}
          onPress={() => router.push('/(tabs)/scan')}
        >
          Scan payment
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
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>Recent records</Text>
            <Button compact onPress={() => router.push('/(tabs)/records')}>See all</Button>
          </View>

          {records.isLoading && feed.length === 0 ? <Loading variant="list" label="Loading records" /> : null}
          {!records.isLoading && feed.length === 0 ? (
            <View style={[styles.empty, { borderColor: theme.colors.outlineVariant }]}>
              <Icon source="receipt-text-outline" size={28} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>No records yet</Text>
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
                      <View style={styles.providerIcon}>
                        <Icon source="wallet-outline" size={22} color={theme.colors.onSurfaceVariant} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>{peso(amount)}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                          {source}{reference ? ` · ${reference.slice(-6)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{manilaTime(item.at)}</Text>
                        {item.kind === 'local' ? <Icon source="cellphone-check" size={16} color={theme.colors.secondary} /> : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontWeight: '700', letterSpacing: -0.8 },
  saved: { minHeight: 88, borderRadius: RADIUS.xl, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  savedIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  compactStatus: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  attention: { minHeight: 60, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionHeading: { minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 76, marginHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  providerIcon: { width: 32, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  empty: { minHeight: 112, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
});
