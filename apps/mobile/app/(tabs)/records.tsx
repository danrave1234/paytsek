import { PROVIDER_LABELS, type EvidenceState, type Provider, type RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentRecordRow } from '@/components/payment-record-row';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { prefetchRecord, useInfiniteRecords, useSources } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE } from '@/theme';

type RowItem =
  | { kind: 'draft'; id: string; draft: Draft; at: string; source: string; amount: number; state: EvidenceState }
  | { kind: 'record'; id: string; record: RecordSummary; at: string; source: string; amount: number; state: EvidenceState };

const providerLabel = (provider: Provider | null | undefined) => provider ? PROVIDER_LABELS[provider] : 'Payment';
const draftTime = (draft: Draft) => draft.request.corrected.receiptTransactionAt ?? draft.request.capturedAt ?? draft.createdAt;
const recordTime = (record: RecordSummary) => record.receiptTransactionAt ?? record.capturedAt ?? record.createdAt;

type EvidenceFilter = 'ALL' | 'STRONG' | 'POSSIBLE' | 'RECORDED' | 'CONFIRMED' | 'VOIDED';
const EVIDENCE_FILTERS: Array<{ value: EvidenceFilter; label: string; states?: EvidenceState[] }> = [
  { value: 'ALL', label: 'All' },
  { value: 'STRONG', label: 'Strong', states: ['MATCHED_AUTO', 'MATCHED_BY_USER'] },
  { value: 'POSSIBLE', label: 'Possible', states: ['REVIEW_REQUIRED'] },
  { value: 'RECORDED', label: 'Recorded', states: ['UNVERIFIED'] },
  { value: 'CONFIRMED', label: 'Confirmed', states: ['CONFIRMED_MANUALLY'] },
  { value: 'VOIDED', label: 'Voided', states: ['VOIDED'] },
];

const dayKey = (iso: string, timezone: string) => new Intl.DateTimeFormat('en-CA', {
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
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function Records() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('ALL');
  const [sourceId, setSourceId] = useState<string | undefined>();
  const sources = useSources();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const evidenceStates = EVIDENCE_FILTERS.find((item) => item.value === evidenceFilter)?.states;
  const query = useInfiniteRecords({ q: search || undefined, state: evidenceStates, sourceId });
  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id, true).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);
  useFocusEffect(useCallback(() => { refreshLocal(); }, [refreshLocal, query.dataUpdatedAt]));

  const rows = useMemo<RowItem[]>(() => {
    const remote = query.data?.pages.flatMap((page) => page.items) ?? [];
    const normalizedSearch = search.toLowerCase().replace(/[₱,\s]/g, '');
    const localRows: RowItem[] = drafts.filter((draft) => {
      if (sourceId && draft.request.sourceId !== sourceId) return false;
      if (evidenceStates && !evidenceStates.includes('UNVERIFIED')) return false;
      if (!normalizedSearch) return true;
      const source = providerLabel(draft.request.corrected.receiptProvider).toLowerCase();
      const amount = (draft.request.corrected.amountCentavos / 100).toFixed(2);
      return source.includes(search.toLowerCase()) || amount.includes(normalizedSearch);
    }).map((draft) => ({
      kind: 'draft',
      id: draft.clientRecordId,
      draft,
      at: draftTime(draft),
      source: providerLabel(draft.request.corrected.receiptProvider),
      amount: draft.request.corrected.amountCentavos,
      state: 'UNVERIFIED',
    }));
    const remoteRows: RowItem[] = remote.map((record) => ({
      kind: 'record',
      id: record.id,
      record,
      at: recordTime(record),
      source: record.sourceLabel,
      amount: record.amountCentavos,
      state: record.evidenceState,
    }));
    return [...localRows, ...remoteRows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [drafts, evidenceStates, query.data?.pages, search, sourceId]);

  const hasFilters = Boolean(search || sourceId || evidenceFilter !== 'ALL');
  const clearFilters = () => {
    setText('');
    setSearch('');
    setSourceId(undefined);
    setEvidenceFilter('ALL');
  };

  const refresh = () => {
    refreshLocal();
    void query.refetch();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}.${item.id}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={refresh}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text variant="headlineSmall" style={styles.title}>Records</Text>
              {hasFilters ? <Pressable onPress={clearFilters} hitSlop={10}><Text variant="labelLarge" style={{ color: theme.colors.primary }}>Clear</Text></Pressable> : null}
            </View>
            <Searchbar
              placeholder="Search wallet or amount"
              value={text}
              onChangeText={setText}
              elevation={0}
              style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
              inputStyle={styles.searchInput}
            />
            <Text variant="labelSmall" style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>EVIDENCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {EVIDENCE_FILTERS.map((filter) => {
                const selected = evidenceFilter === filter.value;
                return (
                  <Pressable
                    key={filter.value}
                    onPress={() => setEvidenceFilter(filter.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.filter, { borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant, backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface }]}
                  >
                    <Text variant="labelMedium" style={{ color: selected ? theme.colors.primary : theme.colors.onSurface }}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {(sources.data?.length ?? 0) > 0 ? (
              <>
                <Text variant="labelSmall" style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>PAYMENT SOURCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                  <Pressable
                    onPress={() => setSourceId(undefined)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !sourceId }}
                    style={[styles.sourceFilter, { borderColor: !sourceId ? theme.colors.primary : theme.colors.outlineVariant, backgroundColor: !sourceId ? theme.colors.primaryContainer : theme.colors.surface }]}
                  >
                    <Text variant="labelMedium" style={{ color: !sourceId ? theme.colors.primary : theme.colors.onSurface }}>All sources</Text>
                  </Pressable>
                  {sources.data?.map((source) => {
                    const selected = sourceId === source.id;
                    return (
                      <Pressable
                        key={source.id}
                        onPress={() => setSourceId(source.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.sourceFilter, { borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant, backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface }]}
                      >
                        <ProviderLogo provider={source.provider} size={22} />
                        <Text variant="labelMedium" numberOfLines={1} style={{ color: selected ? theme.colors.primary : theme.colors.onSurface }}>{source.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        )}
        ListEmptyComponent={query.isLoading
          ? <Loading variant="list" label="Loading records" />
          : !workspace
            ? <EmptyState icon="folder-outline" title="Choose a workspace" action={{ label: 'Choose workspace', onPress: () => router.push('/workspaces') }} />
          : query.error
            ? <ErrorState error={query.error} retry={refresh} />
            : hasFilters
              ? <EmptyState icon="filter-outline" title="No matching records" action={{ label: 'Clear filters', onPress: clearFilters }} />
              : <EmptyState icon="receipt-text-outline" title="No records yet" body="Your saved payment proofs will appear here." action={{ label: 'Scan payment', onPress: () => router.push('/(tabs)/scan') }} />}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : <View style={styles.footer} />}
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
              <PaymentRecordRow
                amountCentavos={item.amount}
                occurredAt={item.at}
                sourceLabel={item.source}
                state={item.state}
                timezone={timezone}
                divider={previousSameDay}
                onPress={item.kind === 'record' ? () => router.push(`/record/${item.record.id}`) : undefined}
                onPressIn={item.kind === 'record' ? () => { void prefetchRecord(item.record.id); } : undefined}
              />
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
  filter: { minHeight: 38, minWidth: 58, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  sourceFilter: { minHeight: 42, maxWidth: 180, paddingHorizontal: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  day: { marginTop: SPACING.lg, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.7 },
  footer: { minHeight: 56, justifyContent: 'center' },
});
