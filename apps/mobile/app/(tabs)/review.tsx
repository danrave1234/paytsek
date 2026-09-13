import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentRecordRow } from '@/components/payment-record-row';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { prefetchRecord, useRecords } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SPACING, TAB_BAR_CLEARANCE } from '@/theme';

/** Records that need a person: candidates exist, conflicts, or escalations. */
export default function Review() {
  const theme = useTheme();
  const router = useRouter();
  const { workspace } = useSession();
  const timezone = workspace?.timezone || 'Asia/Manila';
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
        renderItem={({ item, index }) => (
          <PaymentRecordRow
            amountCentavos={item.amountCentavos}
            occurredAt={item.receiptTransactionAt ?? item.capturedAt ?? item.createdAt}
            sourceLabel={item.sourceLabel}
            state={item.evidenceState}
            timezone={timezone}
            divider={index > 0}
            onPress={() => router.push(`/record/${item.id}`)}
            onPressIn={() => { void prefetchRecord(item.id); }}
          />
        )}
      />
    </SafeAreaView>
  );
}
