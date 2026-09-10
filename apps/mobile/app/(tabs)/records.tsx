import type { EvidenceState, RecordSummary } from '@paytsek/contracts';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, Chip, Icon, Searchbar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, Notice, ScreenTitle, StateChip, SyncChip } from '@/components/ui';
import { listDrafts, type Draft } from '@/lib/drafts';
import { manilaTime, peso } from '@/lib/format';
import { useHome, useRecords } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { OfflineError } from '@/lib/api';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE } from '@/theme';

const FILTERS: { key: EvidenceState | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNVERIFIED', label: 'Unverified' },
  { key: 'REVIEW_REQUIRED', label: 'Review' },
  { key: 'MATCHED_AUTO', label: 'Matched' },
  { key: 'CONFIRMED_MANUALLY', label: 'Manual' },
  { key: 'VOIDED', label: 'Voided' },
];

type DateScope = 'TODAY' | 'ALL';

/** Manila has no daylight-saving time, so these are stable API boundaries. */
function manilaTodayBounds() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const value = (kind: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === kind)?.value);
  const year = value('year'); const month = value('month'); const day = value('day');
  const start = Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  return { from: new Date(start).toISOString(), to: new Date(start + 24 * 60 * 60 * 1000).toISOString() };
}

const todayLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

export default function Records() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(q), 300); return () => clearTimeout(timer); }, [q]);
  const [filter, setFilter] = useState<EvidenceState | 'ALL'>('ALL');
  const [dateScope, setDateScope] = useState<DateScope>('TODAY');
  const [cursor, setCursor] = useState<string | undefined>();
  const [items, setItems] = useState<RecordSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const state = filter === 'ALL' ? undefined : filter === 'MATCHED_AUTO' ? ['MATCHED_AUTO', 'MATCHED_BY_USER'] : [filter];
  const bounds = manilaTodayBounds();
  const query = useRecords({ q: search || undefined, state, from: dateScope === 'TODAY' ? bounds.from : undefined, to: dateScope === 'TODAY' ? bounds.to : undefined, cursor });
  const home = useHome();

  useEffect(() => { setCursor(undefined); setItems([]); }, [search, filter, dateScope]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (cursor ? [...prev, ...query.data.items.filter((i) => !prev.some((p) => p.id === i.id))] : query.data.items));
  }, [query.data, cursor]);
  useEffect(() => {
    // Local drafts are an enhancement. A damaged/unavailable SQLite cache
    // must not prevent the server-backed daily ledger from opening.
    if (workspace) void listDrafts(workspace.id, true).then(setDrafts).catch(() => setDrafts([]));
  }, [workspace, query.dataUpdatedAt]);

  const offline = query.error instanceof OfflineError;
  const verifiedTotal = (home.data?.today.notificationMatchedCentavos ?? 0) + (home.data?.today.confirmedManuallyCentavos ?? 0);
  const verifiedCount = (home.data?.today.notificationMatchedCount ?? 0) + (home.data?.today.confirmedManuallyCount ?? 0);
  const pendingCount = (home.data?.today.unverifiedCount ?? 0) + (home.data?.today.reviewRequiredCount ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md }}>
        <ScreenTitle title="Records" subtitle={dateScope === 'TODAY' ? `${todayLabel} · your payment ledger` : 'Search every captured payment'} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Chip selected={dateScope === 'TODAY'} onPress={() => setDateScope('TODAY')} showSelectedCheck={false} icon="calendar-today">Today</Chip>
          <Chip selected={dateScope === 'ALL'} onPress={() => setDateScope('ALL')} showSelectedCheck={false} icon="calendar-range">All time</Chip>
        </View>
        {dateScope === 'TODAY' ? (
          <View style={{ padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.colors.primaryContainer, gap: SPACING.xs }}>
            <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>VERIFIED RECEIVED TODAY</Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700', letterSpacing: -0.55 }}>{peso(verifiedTotal)}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
              {verifiedCount} confirmed payment{verifiedCount === 1 ? '' : 's'}{pendingCount ? ` · ${pendingCount} need${pendingCount === 1 ? 's' : ''} review` : ''}
            </Text>
          </View>
        ) : null}
        <Searchbar
          placeholder="Payer, reference, or note"
          value={q}
          onChangeText={setQ}
          elevation={0}
          style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}
          inputStyle={{ minHeight: 0 }}
        />
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(f) => f.key} contentContainerStyle={{ gap: SPACING.sm }}
          renderItem={({ item }) => <Chip selected={filter === item.key} onPress={() => setFilter(item.key)} showSelectedCheck={false}>{item.label}</Chip>} />
        {offline ? <Notice kind="warning">Offline — showing last synced list. Evidence states may be stale.</Notice> : null}
      </View>
      <FlatList
        data={cursor ? items : (query.data?.items ?? [])}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: TAB_BAR_CLEARANCE, gap: SPACING.md }}
        refreshing={query.isRefetching}
        onRefresh={() => { setCursor(undefined); void query.refetch(); }}
        onEndReached={() => { if (query.data?.nextCursor && !query.isFetching) setCursor(query.data.nextCursor); }}
        ListHeaderComponent={drafts.length ? (
          <View style={{ gap: SPACING.md, marginBottom: SPACING.sm }}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>On this phone (not yet synced)</Text>
            {drafts.map((d) => (
              <Card key={d.clientRecordId} mode="outlined">
                <Card.Content style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700', letterSpacing: -0.3 }}>{peso(d.request.corrected.amountCentavos)}</Text>
                    <SyncChip status={d.syncStatus} quotaBlocked={d.quotaBlocked} />
                  </View>
                  <Text variant="bodySmall" style={{ opacity: 0.7 }}>{manilaTime(d.createdAt)} · {d.request.corrected.referenceValue ?? 'no reference'}</Text>
                  {d.lastError ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{d.lastError}</Text> : null}
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : undefined}
        ListEmptyComponent={query.isLoading ? <Loading variant="list" label="Loading records" /> : query.error && !offline ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <EmptyState icon="file-document-multiple-outline" title="No records yet" body="Scan a receipt to create your first record." action={{ label: 'Scan a receipt', onPress: () => router.push('/(tabs)/scan') }} />}
        renderItem={({ item }) => (
          <Card mode="contained" onPress={() => router.push(`/record/${item.id}`)} accessibilityRole="button" style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryContainer }}>
                <Icon source="receipt-text-outline" size={21} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyLarge" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {item.payerName || item.customerLabel || 'Payer not captured'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                  {item.sourceLabel} · {item.referenceValue ? `Ref ${item.referenceValue}` : 'No reference'} · {manilaTime(item.createdAt)}
                </Text>
                <StateChip state={item.evidenceState} compact />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700', letterSpacing: -0.3 }}>{peso(item.amountCentavos)}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.createdByDisplayName}</Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
