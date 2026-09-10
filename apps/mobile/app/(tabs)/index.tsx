import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, ProgressBar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, Loading, Notice, ScreenTitle } from '@/components/ui';
import { countDrafts, syncAll } from '@/lib/drafts';
import { lastSeen, peso } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useIsOwner, useSession } from '@/lib/session';
import { OfflineError } from '@/lib/api';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/theme';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workspace } = useSession();
  const isOwner = useIsOwner();
  const home = useHome();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (workspace) void countDrafts(workspace.id).then(setPending).catch(() => setPending(0));
  }, [workspace, home.dataUpdatedAt]);

  const retrySync = async () => {
    if (!workspace) return;
    try {
      await syncAll(workspace.id);
      setPending(await countDrafts(workspace.id));
      await home.refetch();
    } catch {
      // The pending local cache is optional; server records remain available.
      setPending(0);
    }
  };

  const offline = home.error instanceof OfflineError;
  const d = home.data;
  const quotaRatio = d ? (d.quota.monthlyAllowance ? d.quota.monthlyUsed / d.quota.monthlyAllowance : 1) : 0;
  const recordedToday = d
    ? d.today.notificationMatchedCentavos + d.today.confirmedManuallyCentavos + d.today.unverifiedCentavos
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.lg, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />}
      >
        <ScreenTitle title={workspace?.name ?? 'PayTsek'} subtitle="Today’s payment records" />

        {offline ? <Notice kind="warning">Offline. Amounts and evidence states may be out of date.</Notice> : null}
        {pending > 0 ? (
          <View style={{ gap: SPACING.xs }}>
            <Notice kind="info">{pending} scan{pending === 1 ? '' : 's'} saved on this phone and waiting to sync.</Notice>
            <Button mode="text" compact onPress={() => void retrySync()}>Retry sync</Button>
          </View>
        ) : null}

        {home.isLoading && !d ? <Loading variant="dashboard" label="Loading dashboard" /> : null}
        {home.error && !d && !offline ? <ErrorState error={home.error} retry={() => void home.refetch()} /> : null}

        {d ? (
          <>
            <Card mode="contained" style={[styles.hero, { backgroundColor: theme.colors.primary }]}>
              <Card.Content style={{ gap: SPACING.lg }}>
                <View>
                  <Text variant="labelLarge" style={{ color: theme.colors.onPrimary, opacity: 0.76 }}>Recorded today</Text>
                  <Text variant="displaySmall" style={{ color: theme.colors.onPrimary, fontWeight: '700', letterSpacing: -1.5, marginTop: 2 }}>
                    {peso(recordedToday)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, opacity: 0.76, marginTop: 6 }}>
                    Evidence totals, never wallet balance
                  </Text>
                </View>
                <Button
                  mode="contained"
                  icon="camera-outline"
                  buttonColor={theme.colors.onPrimary}
                  textColor={theme.colors.primary}
                  contentStyle={{ minHeight: TOUCH_TARGET }}
                  onPress={() => router.push('/(tabs)/scan')}
                >
                  Scan payment proof
                </Button>
              </Card.Content>
            </Card>

            <View style={{ gap: SPACING.sm }}>
              <Text variant="titleMedium" style={{ fontWeight: '700', letterSpacing: -0.3 }}>Verification status</Text>
              <View style={[styles.metricsGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <MetricRow icon="bell-check-outline" tone="success" title="Notification matched" count={d.today.notificationMatchedCount} amount={d.today.notificationMatchedCentavos} />
                <View style={[styles.metricDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <MetricRow icon="account-check-outline" tone="primary" title="Confirmed manually" count={d.today.confirmedManuallyCount} amount={d.today.confirmedManuallyCentavos} />
                <View style={[styles.metricDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <MetricRow icon="clock-outline" tone="neutral" title="Unverified" count={d.today.unverifiedCount} amount={d.today.unverifiedCentavos} />
              </View>
              {d.today.reviewRequiredCount > 0 ? (
                <TouchableRipple onPress={() => router.push('/(tabs)/review')} borderless style={{ borderRadius: RADIUS.lg }}>
                  <View style={[styles.attention, { backgroundColor: theme.colors.tertiaryContainer }]}>
                    <Icon source="alert-outline" size={22} color={theme.colors.onTertiaryContainer} />
                    <View style={{ flex: 1 }}>
                      <Text variant="titleSmall" style={{ color: theme.colors.onTertiaryContainer, fontWeight: '700' }}>Needs your review</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer, opacity: 0.8 }}>
                        {d.today.reviewRequiredCount} record{d.today.reviewRequiredCount === 1 ? '' : 's'} need a decision
                      </Text>
                    </View>
                    <Icon source="chevron-right" size={22} color={theme.colors.onTertiaryContainer} />
                  </View>
                </TouchableRipple>
              ) : null}
            </View>

            <Card mode="contained" style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}>
              <Card.Content style={{ gap: SPACING.md }}>
                <View style={styles.cardHeading}>
                  <Icon source="cellphone-message" size={24} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>Payment phone</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {d.collectors.length === 0 ? 'Not connected' : `${d.collectors.length} connected`}
                    </Text>
                  </View>
                </View>

                {d.collectors.length === 0 ? (
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 21 }}>
                    Connect an Android phone that receives payment notifications to enable automatic matching.
                  </Text>
                ) : null}
                {d.collectors.map((c) => (
                  <View key={c.deviceId} style={[styles.deviceRow, { borderTopColor: theme.colors.outlineVariant }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: '700' }}>{c.label} · {c.sourceLabel}</Text>
                      <Text variant="bodySmall" style={{ color: c.stale ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                        {lastSeen(c.lastSeenAt)}{c.stale ? ' · Collection may be interrupted' : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: c.stale ? theme.colors.error : theme.colors.secondary }]} />
                  </View>
                ))}
                {isOwner ? <Button mode="text" compact onPress={() => router.push('/settings/devices')}>Manage devices</Button> : null}
              </Card.Content>
            </Card>

            <Card mode="contained" style={{ backgroundColor: theme.colors.surface, borderRadius: RADIUS.lg }}>
              <Card.Content style={{ gap: SPACING.md }}>
                <View style={styles.cardHeading}>
                  <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>Monthly records</Text>
                  <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                    {d.quota.monthlyUsed} / {d.quota.monthlyAllowance}
                  </Text>
                </View>
                <ProgressBar progress={Math.min(quotaRatio, 1)} color={quotaRatio >= 1 ? theme.colors.error : theme.colors.primary} style={{ height: 8, borderRadius: 999 }} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {d.quota.monthlyAllowance - d.quota.monthlyUsed} records remaining this month
                </Text>
                {quotaRatio >= 1 ? <Notice kind="error">Monthly allowance used up. New scans stay as local drafts.</Notice> : quotaRatio >= 0.8 ? <Notice kind="warning">You have used {Math.round(quotaRatio * 100)}% of this month’s records.</Notice> : null}
                {isOwner ? <Button mode="text" compact onPress={() => router.push('/settings/billing')}>Plan and usage</Button> : null}
              </Card.Content>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({ icon, tone, title, count, amount }: { icon: string; tone: 'success' | 'primary' | 'neutral'; title: string; count: number; amount: number }) {
  const theme = useTheme();
  const iconFg = tone === 'success' ? theme.colors.secondary : tone === 'primary' ? theme.colors.primary : theme.colors.onSurfaceVariant;
  return (
    <View style={styles.metric}>
      <Icon source={icon} size={21} color={iconFg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" style={{ fontWeight: '700' }}>{title}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{count} record{count === 1 ? '' : 's'}</Text>
      </View>
      <Text variant="titleMedium" style={{ fontWeight: '700', letterSpacing: -0.3 }}>{peso(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  metricsGroup: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  metric: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  metricDivider: { height: StyleSheet.hairlineWidth, marginLeft: 49 },
  attention: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
