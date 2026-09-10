import type { BillingProduct, CheckoutSession, LedgerEntry } from '@paytsek/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { manilaTime } from '@/lib/format';
import { useUsage } from '@/lib/queries';
import { TOUCH_TARGET } from '@/theme';

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
  return <Screen>
    {usage.isLoading ? <Loading /> : usage.error ? <ErrorState error={usage.error} retry={() => void usage.refetch()} /> : null}
    {u ? <Card mode="outlined"><Card.Title title={`${u.planCode} plan`} subtitle={u.subscriptionStatus === 'NONE' ? 'No active monthly pass' : `Active until ${manilaTime(u.periodEnd, 'DAY')}`} /><Card.Content>
      <Row label="Billing period" value={`${manilaTime(u.periodStart, 'DAY')} – ${manilaTime(u.periodEnd, 'DAY')}`} /><Row label="Records used" value={`${u.monthlyUsed} / ${u.monthlyAllowance}`} />
      <Row label="Scanner devices" value={`${u.usage.scannerDevices} / ${u.limits.scannerDevices}`} /><Row label="Collector devices" value={`${u.usage.collectorDevices} / ${u.limits.collectorDevices}`} /><Row label="Payment sources" value={`${u.usage.receivingSources} / ${u.limits.receivingSources}`} /><Row label="Members" value={`${u.usage.members} / ${u.limits.members}`} />
      {u.warnLevelsCrossed.includes(1) ? <Notice kind="error">Monthly allowance used. Renew or choose a larger plan to keep saving records.</Notice> : u.warnLevelsCrossed.includes(0.8) ? <Notice kind="warning">80% of this month&apos;s records used.</Notice> : null}
    </Card.Content></Card> : null}
    <Notice kind="info">One record is one new saved payment. QRPh renewals require your approval each period; paying early extends an active plan from its end date.</Notice>
    {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    {products.data?.map((p) => <Card key={p.key} mode="outlined"><Card.Title title={`${p.planCode} · 30-day billing period`} subtitle={`₱${(p.priceCentavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} /><Card.Content><Text variant="bodySmall">{p.records} records each billing period with paid-plan limits and 90-day proof retention. QRPh does not automatically charge you.</Text></Card.Content><Card.Actions><Button mode="contained" loading={busy === p.key} disabled={busy !== null} onPress={() => void checkout(p)} style={{ minHeight: TOUCH_TARGET }}>{u?.subscriptionStatus === 'ACTIVE' ? 'Extend access' : `Choose ${p.planCode}`}</Button></Card.Actions></Card>)}
    <Text variant="titleMedium" style={{ marginTop: 8 }}>Billing activity</Text>
    {ledger.data?.slice(0, 50).map((e) => <Row key={e.id} label={`${manilaTime(e.at)} · ${e.kind.toLowerCase().replace(/_/g, ' ')}`} value={`${e.delta > 0 ? '+' : ''}${e.delta}`} />)}
  </Screen>;
}
