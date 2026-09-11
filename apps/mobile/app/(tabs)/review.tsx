import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, View } from 'react-native';
import { Card, Icon, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, StateChip } from '@/components/ui';
import { manilaTime, peso } from '@/lib/format';
import { useRecords } from '@/lib/queries';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE } from '@/theme';

/** Records that need a person: candidates exist, conflicts, or escalations. */
export default function Review() {
  const theme = useTheme();
  const router = useRouter();
  const q = useRecords({ state: ['REVIEW_REQUIRED', 'UNVERIFIED'] });
  const items = (q.data?.items ?? []).filter((r) => r.evidenceState === 'REVIEW_REQUIRED' || r.candidateCount > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: TAB_BAR_CLEARANCE, gap: SPACING.sm }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={{ paddingTop: SPACING.md, paddingBottom: SPACING.sm }}>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>Needs attention</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Only payments that need a decision appear here.</Text>
          </View>
        )}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListEmptyComponent={q.isLoading ? <Loading variant="list" label="Loading" /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : <EmptyState icon="clipboard-check-outline" title="All clear" />}
        renderItem={({ item }) => (
          <Card mode="contained" onPress={() => router.push(`/record/${item.id}`)} style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <Icon source="clipboard-search-outline" size={22} color={theme.colors.tertiary} />
              <View style={{ flex: 1, gap: SPACING.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm }}>
                  <Text variant="titleMedium">{peso(item.amountCentavos)}</Text>
                  <StateChip state={item.evidenceState} compact />
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {item.candidateCount} candidate notification{item.candidateCount === 1 ? '' : 's'} · {item.sourceLabel}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {manilaTime(item.createdAt)} · {item.referenceValue ? `Ref ${item.referenceValue}` : 'No reference on receipt'}
                </Text>
              </View>
              <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
            </Card.Content>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
