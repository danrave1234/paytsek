import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Loading, Notice, StateChip } from '@/components/ui';
import { manilaTime, peso } from '@/lib/format';
import { useRecords } from '@/lib/queries';

/** Records that need a person: candidates exist, conflicts, or escalations. */
export default function Review() {
  const theme = useTheme();
  const router = useRouter();
  const q = useRecords({ state: ['REVIEW_REQUIRED', 'UNVERIFIED'] });
  const items = (q.data?.items ?? []).filter((r) => r.evidenceState === 'REVIEW_REQUIRED' || r.candidateCount > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ padding: 16, gap: 8 }}>
        <Text variant="headlineSmall">Review</Text>
        <Notice kind="info">Same amount and time alone never confirm a payment automatically. Compare the details, then confirm only if you are sure.</Notice>
      </View>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : <EmptyState icon="clipboard-check-outline" title="Nothing to review" body="Records with candidate notifications or conflicts appear here." />}
        renderItem={({ item }) => (
          <Card mode="outlined" onPress={() => router.push(`/record/${item.id}`)}>
            <Card.Content style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="titleMedium">{peso(item.amountCentavos)}</Text>
                <StateChip state={item.evidenceState} compact />
              </View>
              <Text variant="bodySmall">{item.candidateCount} candidate notification{item.candidateCount === 1 ? '' : 's'} · {item.sourceLabel}</Text>
              <Text variant="bodySmall" style={{ opacity: 0.6 }}>{manilaTime(item.createdAt)} · {item.referenceValue ? `Ref ${item.referenceValue}` : 'No reference on receipt'}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
