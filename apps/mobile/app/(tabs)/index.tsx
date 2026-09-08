import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, Loading, Notice, Row, ScreenTitle } from '@/components/ui';
import { countDrafts, syncAll } from '@/lib/drafts';
import { lastSeen, peso } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { OfflineError } from '@/lib/api';
import { SPACING } from '@/theme';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workspace } = useSession();
  const isOwner = useIsOwner();
  const home = useHome();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (workspace) void countDrafts(workspace.id).then(setPending);
  }, [workspace, home.dataUpdatedAt]);

  const retrySync = async () => {
    if (!workspace) return;
    await syncAll(workspace.id);
    setPending(await countDrafts(workspace.id));
    await home.refetch();
  };

  const offline = home.error instanceof OfflineError;
  const d = home.data;
  const quotaRatio = d ? (d.quota.monthlyAllowance ? d.quota.monthlyUsed / d.quota.monthlyAllowance : 1) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: insets.bottom + SPACING.xxl }} refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />}>
        <ScreenTitle title={workspace?.name ?? 'Today'} subtitle="Today · recorded payments, not wallet balance" />
        {workspace?.isDemo ? <Notice kind="warning">Demo workspace — records here never count toward real totals or billing.</Notice> : null}
        {offline ? <Notice kind="warning">Offline. Showing the last data received from the server; nothing here is verified while offline.</Notice> : null}
        {pending > 0 ? (
          <Notice kind="info">
            {pending} scan{pending === 1 ? '' : 's'} saved on this phone and not yet synced. They are not verified until the server receives them.{' '}
          </Notice>
        ) : null}
        {pending > 0 ? <Button mode="text" onPress={() => void retrySync()}>Retry sync now</Button> : null}

        {home.isLoading && !d ? <Loading /> : null}
        {home.error && !d && !offline ? <ErrorState error={home.error} retry={() => void home.refetch()} /> : null}

        {d ? (
          <>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <Stat title="Notification matched" count={d.today.notificationMatchedCount} amount={d.today.notificationMatchedCentavos} />
              <Stat title="Confirmed manually" count={d.today.confirmedManuallyCount} amount={d.today.confirmedManuallyCentavos} />
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <Stat title="Unverified" count={d.today.unverifiedCount} amount={d.today.unverifiedCentavos} />
              <Card
                mode="contained"
                style={{ flex: 1, backgroundColor: d.today.reviewRequiredCount > 0 ? theme.colors.tertiaryContainer : theme.colors.elevation.level1 }}
                onPress={() => router.push('/(tabs)/review')}
                accessibilityLabel={`Review needed: ${d.today.reviewRequiredCount}. Tap to review.`}
              >
                <Card.Content style={{ gap: 2 }}>
                  <Text variant="labelMedium" style={{ color: d.today.reviewRequiredCount > 0 ? theme.colors.onTertiaryContainer : theme.colors.onSurfaceVariant }}>Review needed</Text>
                  <Text variant="headlineMedium" style={{ fontWeight: '700', letterSpacing: -0.5, color: d.today.reviewRequiredCount > 0 ? theme.colors.onTertiaryContainer : theme.colors.onSurface }}>{d.today.reviewRequiredCount}</Text>
                  <Text variant="bodySmall" style={{ color: d.today.reviewRequiredCount > 0 ? theme.colors.onTertiaryContainer : theme.colors.onSurfaceVariant }}>Tap to review</Text>
                </Card.Content>
              </Card>
            </View>

            <Card mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
              <Card.Title title="Payment phone" subtitle={d.collectors.length === 0 ? 'No Android payment phone connected' : `${d.collectors.length} connected`} />
              <Card.Content style={{ gap: 8 }}>
                {d.collectors.length === 0 ? (
                  <Text variant="bodySmall">Records are saved and can be confirmed manually. Connect an Android phone that receives your GCash notifications to enable matching.</Text>
                ) : null}
                {d.collectors.map((c) => (
                  <View key={c.deviceId} style={{ gap: 2 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{c.label} · {c.sourceLabel}</Text>
                    <Text variant="bodySmall" style={{ color: c.stale ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                      {lastSeen(c.lastSeenAt)}{c.stale ? ' — collection may be interrupted' : ''}
                    </Text>
                    {c.notificationAccessGranted === false ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>Notification access is off on that phone.</Text> : null}
                    {c.pendingUploadCount ? <Text variant="bodySmall">{c.pendingUploadCount} notification(s) waiting to upload</Text> : null}
                  </View>
                ))}
                {d.collectors.some((c) => c.stale) ? <Notice kind="warning">Unverified payments are not unpaid. The phone has simply not reported recently.</Notice> : null}
              </Card.Content>
              {isOwner ? <Card.Actions><Button onPress={() => router.push('/settings/devices')}>Manage devices</Button></Card.Actions> : null}
            </Card>

            <Card mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
              <Card.Title title="Monthly records" />
              <Card.Content>
                <Row label="Used this month" value={`${d.quota.monthlyUsed} / ${d.quota.monthlyAllowance}`} />
                <Row label="Prepaid credits" value={String(d.quota.prepaidCreditsRemaining)} />
                {quotaRatio >= 1 ? <Notice kind="error">Monthly allowance used up. New scans stay as local drafts until you top up or the month resets. Existing records keep matching.</Notice> : quotaRatio >= 0.8 ? <Notice kind="warning">You have used {Math.round(quotaRatio * 100)}% of this month's records.</Notice> : null}
              </Card.Content>
              {isOwner ? <Card.Actions><Button onPress={() => router.push('/settings/billing')}>Plan & usage</Button></Card.Actions> : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ title, count, amount }: { title: string; count: number; amount: number }) {
  const theme = useTheme();
  return (
    <Card mode="contained" style={{ flex: 1, backgroundColor: theme.colors.elevation.level1 }}>
      <Card.Content style={{ gap: 2 }}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={2}>{title}</Text>
        <Text variant="headlineMedium" style={{ fontWeight: '700', letterSpacing: -0.5 }}>{count}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{peso(amount)}</Text>
      </Card.Content>
    </Card>
  );
}
