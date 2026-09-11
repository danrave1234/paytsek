import type { EvidenceState, RecordSummary } from '@paytsek/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Chip, Icon, Searchbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, ScreenTitle } from '@/components/ui';
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
      <View style={styles.header}>
        <ScreenTitle title="Records" />
        <Searchbar
          placeholder="Search"
          value={text}
          onChangeText={setText}
          elevation={0}
          style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}
          inputStyle={{ minHeight: 0 }}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ gap: SPACING.sm }}
          renderItem={({ item }) => (
            <Chip selected={filter.key === item.key} showSelectedCheck={false} onPress={() => setFilter(item)}>{item.label}</Chip>
          )}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}.${item.id}`}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={refresh}
        ListEmptyComponent={query.isLoading
          ? <Loading variant="list" label="Loading records" />
          : query.error
            ? <ErrorState error={query.error} retry={refresh} />
            : <EmptyState icon="receipt-text-outline" title="No records" action={{ label: 'Scan proof', onPress: () => router.push('/(tabs)/scan') }} />}
        renderItem={({ item, index }) => {
          const amount = item.kind === 'draft' ? item.draft.request.corrected.amountCentavos : item.record.amountCentavos;
          const reference = item.kind === 'draft' ? item.draft.request.corrected.referenceValue : item.record.referenceValue;
          const source = item.kind === 'draft' ? (item.draft.request.corrected.receiptProvider ?? 'Payment') : item.record.sourceLabel;
          const needsAttention = item.kind === 'record' && item.record.evidenceState === 'REVIEW_REQUIRED';
          return (
            <TouchableRipple
              onPress={item.kind === 'record' ? () => router.push(`/record/${item.record.id}`) : undefined}
              disabled={item.kind === 'draft'}
            >
              <View style={[styles.row, { borderTopColor: index ? theme.colors.outlineVariant : 'transparent' }]}>
                <View style={[styles.icon, { backgroundColor: needsAttention ? theme.colors.tertiaryContainer : theme.colors.primaryContainer }]}>
                  <Icon source={needsAttention ? 'alert-outline' : 'wallet-outline'} size={21} color={needsAttention ? theme.colors.onTertiaryContainer : theme.colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>{source}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                    {reference ? `•••• ${reference.slice(-4)}` : 'No reference'} · {manilaTime(item.at)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>{peso(amount)}</Text>
                  {item.kind === 'draft' ? <Icon source="cellphone-check" size={16} color={theme.colors.secondary} /> : needsAttention ? <Text variant="labelSmall" style={{ color: theme.colors.tertiary }}>Review</Text> : null}
                </View>
              </View>
            </TouchableRipple>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: TAB_BAR_CLEARANCE, backgroundColor: 'transparent' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
