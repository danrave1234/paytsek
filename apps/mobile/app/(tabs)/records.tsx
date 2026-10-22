import { EVIDENCE_STATE_LABELS, PROVIDERS, type EvidenceState, type Provider, type RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Searchbar, Text, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { AppearMotion } from '@/components/motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentRecordRow } from '@/components/payment-record-row';
import { SyncStatus } from '@/components/sync-status';
import { EmptyState, ErrorState, Loading, Notice } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { draftOccurredAt, providerLabel, recordOccurredAt } from '@/lib/feed';
import { getFormatter } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { prefetchRecord, useDraftsSignal, useInfiniteRecords } from '@/lib/queries';
import { matchesRecordFilters } from '@/lib/record-filters';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/theme';

type RowItem =
  | { kind: 'draft'; id: string; draft: Draft; at: string; source: string; amount: number; state: EvidenceState; onPress: () => void; onPressIn?: () => void }
  | { kind: 'record'; id: string; record: RecordSummary; at: string; source: string; amount: number; state: EvidenceState; onPress: () => void; onPressIn?: () => void };

type EvidenceFilter = 'ALL' | 'STRONG' | 'POSSIBLE' | 'RECORDED' | 'CONFIRMED' | 'VOIDED';
const EVIDENCE_FILTERS: Array<{ value: EvidenceFilter; label: string; states?: EvidenceState[] }> = [
  { value: 'ALL', label: 'All' },
  { value: 'STRONG', label: EVIDENCE_STATE_LABELS.MATCHED_AUTO, states: ['MATCHED_AUTO', 'MATCHED_BY_USER'] },
  { value: 'POSSIBLE', label: EVIDENCE_STATE_LABELS.REVIEW_REQUIRED, states: ['REVIEW_REQUIRED'] },
  { value: 'RECORDED', label: EVIDENCE_STATE_LABELS.UNVERIFIED, states: ['UNVERIFIED'] },
  { value: 'CONFIRMED', label: EVIDENCE_STATE_LABELS.CONFIRMED_MANUALLY, states: ['CONFIRMED_MANUALLY'] },
  { value: 'VOIDED', label: EVIDENCE_STATE_LABELS.VOIDED, states: ['VOIDED'] },
];

const dayKey = (iso: string, timezone: string) => getFormatter('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(iso));

function dayLabel(iso: string, timezone: string) {
  const key = dayKey(iso, timezone);
  const today = dayKey(new Date().toISOString(), timezone);
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString(), timezone);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return getFormatter('en-PH', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function FilterChip({ selected, onPress, style, children }: {
  selected: boolean;
  onPress: () => void;
  style: object;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => { if (!selected) haptics.select(); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[style, { borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant, backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface }]}
    >
      {children}
    </Pressable>
  );
}

export default function Records() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [localError, setLocalError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('ALL');
  const [provider, setProvider] = useState<Provider | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const evidenceStates = EVIDENCE_FILTERS.find((item) => item.value === evidenceFilter)?.states;
  const query = useInfiniteRecords({ q: search || undefined, state: evidenceStates, provider });
  const updatingFilters = text.trim() !== search || query.isPlaceholderData;
  const paused = query.fetchStatus === 'paused';
  const draftsSignal = useDraftsSignal();
  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id, true).then((rows) => { setDrafts(rows); setLocalError(false); }).catch(() => setLocalError(true));
  }, [workspace]);
  useFocusEffect(useCallback(() => { refreshLocal(); }, [refreshLocal, draftsSignal]));

  const rows = useMemo<RowItem[]>(() => {
    const remote = query.data?.pages.flatMap((page) => page.items) ?? [];
    const filters = { q: text.trim(), state: evidenceStates, provider };
    const localRows: RowItem[] = drafts.filter((draft) => matchesRecordFilters({
      receiptProvider: draft.request.corrected.receiptProvider,
      amountCentavos: draft.request.corrected.amountCentavos,
      evidenceState: 'UNVERIFIED',
    }, filters)).map((draft) => ({
      kind: 'draft',
      id: draft.clientRecordId,
      draft,
      at: draftOccurredAt(draft),
      source: providerLabel(draft.request.corrected.receiptProvider),
      amount: draft.request.corrected.amountCentavos,
      state: 'UNVERIFIED',
      onPress: () => router.push(`/record/local/${draft.clientRecordId}`),
    }));
    // Cached rows remain useful while a new filter loads, but must satisfy it.
    const remoteRows: RowItem[] = remote.filter((record) => matchesRecordFilters(record, filters)).map((record) => ({
      kind: 'record',
      id: record.id,
      record,
      at: recordOccurredAt(record),
      source: providerLabel(record.receiptProvider),
      amount: record.amountCentavos,
      state: record.evidenceState,
      onPress: () => router.push(`/record/${record.id}`),
      onPressIn: () => { void prefetchRecord(record.id); },
    }));
    const canonicalIds = new Set(remote.map((record) => record.clientRecordId));
    return [...localRows.filter((row) => !canonicalIds.has(row.id)), ...remoteRows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [drafts, evidenceStates, provider, query.data?.pages, router, text]);

  const hasFilters = Boolean(text.trim() || provider || evidenceFilter !== 'ALL');
  const clearFilters = () => {
    setText('');
    setSearch('');
    setProvider(undefined);
    setEvidenceFilter('ALL');
  };

  // Only a user-initiated pull shows the top spinner; the background poll must
  // silently replace stale content without any visible loading indicator.
  const refresh = async () => {
    setRefreshing(true);
    try {
      refreshLocal();
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetching && !updatingFilters && !paused) {
      void query.fetchNextPage({ cancelRefetch: false });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}.${item.id}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (!query.isFetchNextPageError) loadMore();
        }}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text variant="headlineSmall" style={styles.title}>Records</Text>
              {hasFilters ? <Pressable onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Clear record filters" style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, justifyContent: 'center' }}><Text variant="labelLarge" style={{ color: theme.colors.primary }}>Clear</Text></Pressable> : null}
            </View>
            <SyncStatus drafts={drafts} />
            {localError ? <Notice kind="error">Saved scans could not be read. Pull to retry; their files remain on this phone.</Notice> : null}
            {query.error && !query.isFetchNextPageError && rows.length > 0 ? <Notice kind="error">Could not refresh server records. Pull to retry.</Notice> : null}
            {paused ? <Notice kind="info">Offline. Showing saved results; server records will load when you reconnect.</Notice>
              : updatingFilters ? <Text accessibilityLiveRegion="polite" variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Updating results…</Text> : null}
            <Searchbar
              placeholder="Search wallet or amount"
              value={text}
              onChangeText={setText}
              maxLength={120}
              elevation={0}
              style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
              inputStyle={styles.searchInput}
            />
            <Text variant="labelSmall" style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>EVIDENCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {EVIDENCE_FILTERS.map((filter) => {
                const selected = evidenceFilter === filter.value;
                return (
                  <FilterChip key={filter.value} selected={selected} onPress={() => setEvidenceFilter(filter.value)} style={styles.filter}>
                    <Text variant="labelMedium" style={{ color: selected ? theme.colors.primary : theme.colors.onSurface }}>{filter.label}</Text>
                  </FilterChip>
                );
              })}
            </ScrollView>
            <Text variant="labelSmall" style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>PAYMENT APP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <FilterChip selected={!provider} onPress={() => setProvider(undefined)} style={styles.sourceFilter}>
                <Text variant="labelMedium" style={{ color: !provider ? theme.colors.primary : theme.colors.onSurface }}>All apps</Text>
              </FilterChip>
              {PROVIDERS.map((item) => {
                const selected = provider === item.value;
                return (
                  <FilterChip key={item.value} selected={selected} onPress={() => setProvider(item.value)} style={styles.sourceFilter}>
                    <ProviderLogo provider={item.value} size={22} />
                    <Text variant="labelMedium" numberOfLines={1} style={{ color: selected ? theme.colors.primary : theme.colors.onSurface }}>{item.label}</Text>
                  </FilterChip>
                );
              })}
            </ScrollView>
          </View>
        )}
        ListEmptyComponent={paused
          ? <EmptyState icon="receipt-text-outline" title="No saved results" body="Reconnect to load server records." />
          : query.isLoading || updatingFilters || !workspace
          ? <Loading variant="list" label="Loading records" />
          : query.error
            ? <ErrorState error={query.error} retry={() => void refresh()} />
            : hasFilters
              ? <EmptyState icon="filter-outline" title="No matching records" action={{ label: 'Clear filters', onPress: clearFilters }} />
              : <EmptyState icon="receipt-text-outline" title="No records yet" body="Saved payment proofs will appear here." />}
        ListFooterComponent={query.isFetchingNextPage && !paused ? <ActivityIndicator accessibilityLabel="Loading more records" style={styles.footer} />
          : query.isFetchNextPageError ? <View style={styles.footer}>
            <Text variant="bodySmall" accessibilityLiveRegion="polite" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Could not load more records. Your loaded records are still here.</Text>
            <Button onPress={loadMore} disabled={query.isFetching || updatingFilters || paused} contentStyle={{ minHeight: TOUCH_TARGET }}>Retry loading more</Button>
          </View> : <View style={styles.footer} />}
        renderItem={({ item, index }) => {
          const showDay = index === 0 || dayKey(rows[index - 1]!.at, timezone) !== dayKey(item.at, timezone);
          const previousSameDay = index > 0 && !showDay;
          return (
            <View>
              {showDay ? (
                <Text variant="labelMedium" style={[styles.day, { color: theme.colors.onSurfaceVariant }]}>
                  {dayLabel(item.at, timezone)}
                </Text>
              ) : null}
              <AppearMotion itemKey={`${item.kind}.${item.id}`} index={index}>
                <PaymentRecordRow
                  amountCentavos={item.amount}
                  occurredAt={item.at}
                  sourceLabel={item.source}
                  state={item.state}
                  timezone={timezone}
                  divider={previousSameDay}
                  onPress={item.onPress}
                  onPressIn={item.onPressIn}
                />
              </AppearMotion>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: SPACING.lg, paddingBottom: TAB_BAR_CLEARANCE + SPACING.xl },
  header: { paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.xs },
  titleRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', letterSpacing: -0.45 },
  search: { minHeight: 48, marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { minHeight: 0, fontSize: 15 },
  filterLabel: { marginTop: SPACING.sm, letterSpacing: 0.7 },
  filters: { gap: 8, paddingVertical: 2, paddingRight: SPACING.md },
  filter: { minHeight: TOUCH_TARGET, minWidth: 58, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  sourceFilter: { minHeight: TOUCH_TARGET, maxWidth: 180, paddingHorizontal: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  day: { marginTop: SPACING.lg, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.7 },
  footer: { minHeight: 56, justifyContent: 'center' },
});
