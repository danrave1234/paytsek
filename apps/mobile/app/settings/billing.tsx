import type { BillingProduct, CheckoutSession, LedgerEntry } from '@paytsek/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Button, Card, List, ProgressBar, Text } from 'react-native-paper';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { manilaTime } from '@/lib/format';
import { useUsage } from '@/lib/queries';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

/** PayMongo hosts checkout in the browser. The server only updates access after a signed webhook. */
export default function Billing() {
  const usage = useUsage(); const qc = useQueryClient();
  const products = useQuery({ queryKey: ['billing-products'], queryFn: () => api<BillingProduct[]>('/v1/billing/products') });
  const ledger = useQuery({ queryKey: ['billing-ledger'], queryFn: () => api<LedgerEntry[]>('/v1/billing/ledger') });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'info' | 'warning' | 'error'; text: string } | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') { void qc.invalidateQueries({ queryKey: ['usage'] }); void qc.invalidateQueries({ queryKey: ['billing-ledger'] }); void qc.invalidateQueries({ queryKey: ['home'] }); } });
    return () => subscription.remove();
  }, [qc]);
  const checkout = async (product: BillingProduct) => {
    setBusy(product.key); setMsg(null);
    try {
      const session = await api<CheckoutSession>('/v1/billing/checkout', { method: 'POST', body: { productKey: product.key } });
      await Linking.openURL(session.checkoutUrl);
      setMsg({ kind: 'info', text: 'Complete payment securely in your browser. Your 30-day access updates after PayMongo confirms it.' });
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message || 'Could not open checkout.' }); } finally { setBusy(null); }
  };
  const u = usage.data;
  const used = u?.monthlyAllowance ? Math.min(1, u.monthlyUsed / u.monthlyAllowance) : 0;
  return <Screen>
    {usage.isLoading ? <Loading /> : usage.error ? <ErrorState error={usage.error} retry={() => void usage.refetch()} /> : null}
    {u ? <Card mode="contained" style={styles.planCard}><Card.Content style={{ gap: SPACING.md }}>
      <View style={styles.planHeading}><View><Text variant="labelMedium">CURRENT PLAN</Text><Text variant="headlineSmall" style={{ fontWeight: '700' }}>{u.planCode}</Text></View><Text variant="labelLarge">{u.monthlyUsed} / {u.monthlyAllowance}</Text></View>
      <ProgressBar progress={used} style={styles.progress} />
      <Text variant="bodySmall">{u.subscriptionStatus === 'NONE' ? 'Free access' : `Access through ${manilaTime(u.periodEnd, 'DAY')}`}</Text>
      {u.warnLevelsCrossed.includes(1) ? <Notice kind="error">Monthly allowance used. Renew or choose a larger plan to keep saving records.</Notice> : u.warnLevelsCrossed.includes(0.8) ? <Notice kind="warning">80% of this month&apos;s records used.</Notice> : null}
      <List.Accordion title="Plan limits" style={styles.accordion}>
        <View style={styles.limitDetails}><Row label="Billing period" value={`${manilaTime(u.periodStart, 'DAY')} – ${manilaTime(u.periodEnd, 'DAY')}`} /><Row label="Scanners" value={`${u.usage.scannerDevices} / ${u.limits.scannerDevices}`} /><Row label="Payment phones" value={`${u.usage.collectorDevices} / ${u.limits.collectorDevices}`} /><Row label="Wallet apps" value={`${u.usage.receivingSources} / ${u.limits.receivingSources}`} /><Row label="Members" value={`${u.usage.members} / ${u.limits.members}`} /></View>
      </List.Accordion>
    </Card.Content></Card> : null}
    {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    <Text variant="titleMedium" style={styles.sectionTitle}>Choose a plan</Text>
    {products.data?.map((p) => <Card key={p.key} mode="outlined" style={styles.product}><Card.Content style={styles.productContent}><View style={{ flex: 1, gap: 2 }}><Text variant="titleMedium" style={{ fontWeight: '700' }}>{p.planCode}</Text><Text variant="bodySmall">{p.records === null ? 'Unlimited records' : `${p.records.toLocaleString()} records`} · 30 days</Text></View><View style={{ alignItems: 'flex-end', gap: SPACING.sm }}><Text variant="titleMedium">₱{(p.priceCentavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}</Text><Button compact mode="contained" loading={busy === p.key} disabled={busy !== null} onPress={() => void checkout(p)}>{u?.subscriptionStatus === 'ACTIVE' ? 'Extend' : 'Choose'}</Button></View></Card.Content></Card>)}
    <Text variant="bodySmall" style={{ opacity: 0.65 }}>Payments open securely in your browser. QRPh plans do not charge automatically.</Text>
    {(ledger.data?.length ?? 0) > 0 ? <Card mode="outlined" style={styles.product}><List.Accordion title={`Billing activity · ${ledger.data!.length}`}><View style={styles.limitDetails}>{ledger.data?.slice(0, 20).map((e) => <Row key={e.id} label={`${manilaTime(e.at)} · ${e.kind.toLowerCase().replace(/_/g, ' ')}`} value={`${e.delta > 0 ? '+' : ''}${e.delta}`} />)}</View></List.Accordion></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  planCard: { borderRadius: RADIUS.xl },
  planHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { height: 8, borderRadius: RADIUS.full },
  accordion: { marginHorizontal: -SPACING.md, marginBottom: -SPACING.sm },
  limitDetails: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  sectionTitle: { fontWeight: '700', marginTop: SPACING.xs },
  product: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  productContent: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
