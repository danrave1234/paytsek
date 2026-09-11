import type { EvidenceState, RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Chip, Icon, Searchbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, StateChip } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useRecords } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE } from '@/theme';

const FILTERS: { key: EvidenceState | 'ALL'; label: string; states?: EvidenceState[] }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'REVIEW_REQUIRED', label: 'Needs attention', states: ['REVIEW_REQUIRED'] },
  { key: 'MATCHED_AUTO', label: 'Matched', states: ['MATCHED_AUTO', 'MATCHED_BY_USER'] },
];

type RowItem =
  | { kind: 'draft'; id: string; draft: Draft; at: string }
  | { kind: 'record'; id: string; record: RecordSummary; at: string };

const manilaDayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(iso));

function dayLabel(iso: string) {
  const key = manilaDayKey(iso);
  const today = manilaDayKey(new Date().toISOString());
  const yesterday = manilaDayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export default function Records() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]> (FILTERS[0]!);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const query = useRecords({ q: search || undefined, state: filter.states });
  const refreshLocal = useCallback(() => {
    if (!workspace) return;
    void listDrafts(workspace.id).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace]);
  useFocusEffect(useCallback(() => { refreshLocal(); }, [refreshLocal, query.dataUpdatedAt]));

  const remote = query.data?.items ?? [];
  const remoteIds = new Set(remote.map((record) => record.id));
  const rows: RowItem[] = [
    ...drafts
      .filter((draft) => filter.key === 'ALL' && (!draft.serverRecordId || !remoteIds.has(draft.serverRecordId)))
      .map((draft): RowItem => ({ kind: 'draft', id: draft.clientRecordId, draft, at: draft.createdAt })),
    ...remote.map((record): RowItem => ({ kind: 'record', id: record.id, record, at: record.createdAt })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

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
        refreshing={query.isRefetching}
        onRefresh={refresh}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View>
                <Text variant="titleLarge" style={styles.title}>Records</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {rows.length ? `${rows.length} recent payment${rows.length === 1 ? '' : 's'}` : 'Your payment history'}
                </Text>
              </View>
            </View>
            <Searchbar
              placeholder="Search records"
              value={text}
              onChangeText={setText}
              elevation={0}
              style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
              inputStyle={{ minHeight: 0 }}
            />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={FILTERS}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Chip
                  compact
                  selected={filter.key === item.key}
                  showSelectedCheck={false}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filter,
                    { backgroundColor: filter.key === item.key ? theme.colors.primaryContainer : theme.colors.surface, borderColor: filter.key === item.key ? theme.colors.primary : theme.colors.outlineVariant },
                  ]}
                  textStyle={{ color: filter.key === item.key ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}
                >
                  {item.label}
                </Chip>
              )}
            />
          </View>
        )}
        ListEmptyComponent={query.isLoading
          ? <Loading variant="list" label="Loading records" />
          : !workspace
            ? <EmptyState icon="folder-outline" title="Choose a workspace" action={{ label: 'Choose workspace', onPress: () => router.push('/workspaces') }} />
          : query.error
            ? <ErrorState error={query.error} retry={refresh} />
            : <EmptyState icon="receipt-text-outline" title="No records" action={{ label: 'Scan payment', onPress: () => router.push('/(tabs)/scan') }} />}
        renderItem={({ item, index }) => {
          const amount = item.kind === 'draft' ? item.draft.request.corrected.amountCentavos : item.record.amountCentavos;
          const reference = item.kind === 'draft' ? item.draft.request.corrected.referenceValue : item.record.referenceValue;
          const source = item.kind === 'draft' ? (item.draft.request.corrected.receiptProvider ?? 'Payment') : item.record.sourceLabel;
          const needsAttention = item.kind === 'record' && item.record.evidenceState === 'REVIEW_REQUIRED';
          const showDay = index === 0 || manilaDayKey(rows[index - 1]!.at) !== manilaDayKey(item.at);
          return (
            <View>
              {showDay ? <Text variant="labelMedium" style={[styles.day, { color: theme.colors.onSurfaceVariant }]}>{dayLabel(item.at)}</Text> : null}
              <TouchableRipple
                onPress={item.kind === 'record' ? () => router.push(`/record/${item.record.id}`) : undefined}
                disabled={item.kind === 'draft'}
                borderless
                style={[styles.recordCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
              >
                <View style={styles.row}>
                  <View style={[styles.providerMark, { backgroundColor: needsAttention ? theme.colors.tertiary : theme.colors.primary }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>{source}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                      {reference ? `Ref •••• ${reference.slice(-4)}` : 'No reference'} · {manilaTime(item.at).split(',').pop()?.trim()}
                    </Text>
                    {item.kind === 'record' ? <StateChip state={item.record.evidenceState} compact /> : null}
                  </View>
                  <View style={styles.amountBlock}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>{peso(amount)}</Text>
                    {item.kind === 'draft' ? (
                      <View style={styles.localState}><Icon source="cellphone-check" size={14} color={theme.colors.onSurfaceVariant} /><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>On phone</Text></View>
                    ) : <Icon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />}
                  </View>
                </View>
              </TouchableRipple>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: SPACING.lg, paddingBottom: TAB_BAR_CLEARANCE + SPACING.lg },
  header: { paddingTop: SPACING.md, paddingBottom: SPACING.lg, gap: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700', letterSpacing: -0.3 },
  search: { minHeight: 48, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  filters: { gap: SPACING.sm, paddingRight: SPACING.lg },
  filter: { borderWidth: StyleSheet.hairlineWidth },
  day: { marginTop: SPACING.sm, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.7 },
  recordCard: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: SPACING.sm, overflow: 'hidden' },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  providerMark: { width: 4, alignSelf: 'stretch', minHeight: 54, borderRadius: RADIUS.full },
  amountBlock: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 2 },
  localState: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
