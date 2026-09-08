import type { EvidenceState, RecordSummary } from '@payrecord/contracts';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, Chip, Searchbar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, Notice, StateChip, SyncChip } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useRecords } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { OfflineError } from '@/lib/api';

const FILTERS: { key: EvidenceState | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNVERIFIED', label: 'Unverified' },
  { key: 'REVIEW_REQUIRED', label: 'Review' },
  { key: 'MATCHED_AUTO', label: 'Matched' },
  { key: 'CONFIRMED_MANUALLY', label: 'Manual' },
  { key: 'VOIDED', label: 'Voided' },
];

export default function Records() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<EvidenceState | 'ALL'>('ALL');
  const [cursor, setCursor] = useState<string | undefined>();
  const [items, setItems] = useState<RecordSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const state = filter === 'ALL' ? undefined : filter === 'MATCHED_AUTO' ? ['MATCHED_AUTO', 'MATCHED_BY_USER'] : [filter];
  const query = useRecords({ q: q || undefined, state, cursor });

  useEffect(() => { setCursor(undefined); setItems([]); }, [q, filter]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (cursor ? [...prev, ...query.data.items.filter((i) => !prev.some((p) => p.id === i.id))] : query.data.items));
  }, [query.data, cursor]);
  useEffect(() => {
    if (workspace) void listDrafts(workspace.id).then((d) => setDrafts(d.filter((x) => x.syncStatus !== 'SYNCED')));
  }, [workspace, query.dataUpdatedAt]);

  const offline = query.error instanceof OfflineError;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text variant="headlineSmall">Records</Text>
        <Searchbar placeholder="Reference, customer, note, sender" value={q} onChangeText={setQ} />
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(f) => f.key} contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip selected={filter === item.key} onPress={() => setFilter(item.key)} showSelectedCheck={false}>{item.label}</Chip>} />
        {offline ? <Notice kind="warning">Offline — showing last synced list. Evidence states may be stale.</Notice> : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        refreshing={query.isRefetching}
        onRefresh={() => { setCursor(undefined); void query.refetch(); }}
        onEndReached={() => { if (query.data?.nextCursor && !query.isFetching) setCursor(query.data.nextCursor); }}
        ListHeaderComponent={drafts.length ? (
          <View style={{ gap: 10, marginBottom: 6 }}>
            <Text variant="titleSmall">On this phone (not yet synced)</Text>
            {drafts.map((d) => (
              <Card key={d.clientRecordId} mode="outlined">
                <Card.Content style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="titleMedium">{peso(d.request.corrected.amountCentavos)}</Text>
                    <SyncChip status={d.syncStatus} quotaBlocked={d.quotaBlocked} />
                  </View>
                  <Text variant="bodySmall" style={{ opacity: 0.7 }}>{manilaTime(d.createdAt)} · {d.request.corrected.referenceValue ?? 'no reference'}</Text>
                  {d.lastError ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{d.lastError}</Text> : null}
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : undefined}
        ListEmptyComponent={query.isLoading ? <Loading /> : query.error && !offline ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <EmptyState icon="receipt" title="No records yet" body="Scan a receipt to create your first record." action={{ label: 'Scan', onPress: () => router.push('/(tabs)/scan') }} />}
        renderItem={({ item }) => (
          <Card mode="outlined" onPress={() => router.push(`/record/${item.id}`)} accessibilityRole="button">
            <Card.Content style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="titleMedium">{peso(item.amountCentavos)}</Text>
                <StateChip state={item.evidenceState} compact />
              </View>
              <Text variant="bodySmall" style={{ opacity: 0.8 }}>
                {item.sourceLabel} · {item.referenceValue ? `Ref ${item.referenceValue}` : 'No reference'}{item.customerLabel ? ` · ${item.customerLabel}` : ''}
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                {manilaTime(item.createdAt)} · by {item.createdByDisplayName}
                {item.candidateCount > 0 && (item.evidenceState === 'UNVERIFIED' || item.evidenceState === 'REVIEW_REQUIRED') ? ` · ${item.candidateCount} candidate${item.candidateCount === 1 ? '' : 's'}` : ''}
                {item.flags.length ? ` · ${item.flags.map((f) => f.replace(/_/g, ' ').toLowerCase()).join(', ')}` : ''}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
