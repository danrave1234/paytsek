import type { BillingProduct, LedgerEntry, UsageSummary } from '@payrecord/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { manilaTime } from '@/lib/format';
import { useUsage } from '@/lib/queries';
import { TOUCH_TARGET } from '@/theme';

/**
 * Native store purchasing via RevenueCat. The server verifies entitlements; a
 * client-side "success" grants nothing until /v1/billing/reconcile confirms.
 * Localized prices come from the storefront, never from our server.
 */
export default function Billing() {
  const usage = useUsage();
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ['billing-products'], queryFn: () => api<BillingProduct[]>('/v1/billing/products') });
  const ledger = useQuery({ queryKey: ['billing-ledger'], queryFn: () => api<LedgerEntry[]>('/v1/billing/ledger') });
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'info' | 'warning' | 'error'; text: string } | null>(null);

  const apiKey = Platform.OS === 'ios' ? env.revenueCatApiKeyIos : env.revenueCatApiKeyAndroid;

  useEffect(() => {
    if (!apiKey) return;
    void (async () => {
      try {
        const { revenueCatAppUserId } = await api<{ revenueCatAppUserId: string }>('/v1/billing/identity');
        Purchases.configure({ apiKey, appUserID: revenueCatAppUserId });
        const offerings = await Purchases.getOfferings();
        setPackages(offerings.current?.availablePackages ?? []);
        setReady(true);
      } catch (e) { setMsg({ kind: 'warning', text: `Store unavailable: ${(e as Error).message}` }); }
    })();
  }, [apiKey]);

  const reconcile = async () => {
    const { revenueCatAppUserId } = await api<{ revenueCatAppUserId: string }>('/v1/billing/identity');
    const r = await api<{ usage: UsageSummary; pendingVerification: boolean }>('/v1/billing/reconcile', { method: 'POST', body: { revenueCatAppUserId } });
    await qc.invalidateQueries({ queryKey: ['usage'] });
    await qc.invalidateQueries({ queryKey: ['billing-ledger'] });
    await qc.invalidateQueries({ queryKey: ['home'] });
    return r;
  };

  const buy = async (p: PurchasesPackage) => {
    setBusy(true); setMsg(null);
    try {
      await Purchases.purchasePackage(p);
      const r = await reconcile();
      setMsg(r.pendingVerification ? { kind: 'warning', text: 'Purchase received but not yet verified by the store. Capacity is granted once verification completes.' } : { kind: 'info', text: 'Purchase verified and applied to this workspace.' });
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) setMsg({ kind: 'error', text: err.message ?? 'Purchase failed' });
    } finally { setBusy(false); }
  };

  const restore = async () => {
    setBusy(true); setMsg(null);
    try {
      await Purchases.restorePurchases();
      await reconcile();
      setMsg({ kind: 'info', text: 'Restore complete. Entitlements were verified server-side for this workspace only.' });
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  };

  const u = usage.data;
  const manage = () => {
    if (u?.managementPlatform === 'APP_STORE') void Linking.openURL('https://apps.apple.com/account/subscriptions');
    else if (u?.managementPlatform === 'PLAY_STORE') void Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  return (
    <Screen>
      {usage.isLoading ? <Loading /> : usage.error ? <ErrorState error={usage.error} retry={() => void usage.refetch()} /> : null}
      {u ? (
        <Card mode="outlined">
          <Card.Title title={`${u.planCode} plan`} subtitle={u.subscriptionStatus === 'NONE' ? 'No subscription' : `Subscription ${u.subscriptionStatus.toLowerCase().replace(/_/g, ' ')}`} />
          <Card.Content>
            <Row label="Period" value={`${manilaTime(u.periodStart, 'DAY')} – ${manilaTime(u.periodEnd, 'DAY')}`} />
            <Row label="Records used" value={`${u.monthlyUsed} / ${u.monthlyAllowance}`} />
            <Row label="Prepaid credits (never expire)" value={String(u.prepaidCreditsRemaining)} />
            <Row label="Scanner devices" value={`${u.usage.scannerDevices} / ${u.limits.scannerDevices}`} />
            <Row label="Collector devices" value={`${u.usage.collectorDevices} / ${u.limits.collectorDevices}`} />
            <Row label="Receiving accounts" value={`${u.usage.receivingSources} / ${u.limits.receivingSources}`} />
            <Row label="Members" value={`${u.usage.members} / ${u.limits.members}`} />
            {u.warnLevelsCrossed.includes(1) ? <Notice kind="error">Monthly allowance used. Monthly allowance is consumed before prepaid credits; there is no automatic overage charge.</Notice> : u.warnLevelsCrossed.includes(0.8) ? <Notice kind="warning">80% of this month's records used.</Notice> : null}
          </Card.Content>
          {u.managementPlatform ? <Card.Actions><Button onPress={manage}>Manage subscription ({u.managementPlatform === 'APP_STORE' ? 'App Store' : 'Google Play'})</Button></Card.Actions> : null}
        </Card>
      ) : null}

      <Notice kind="info">One record = one new saved payment. Duplicates, retries, matching, review, exports and notification collection are never charged.</Notice>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}

      {!apiKey ? <Notice kind="warning">In-app purchases are not configured in this build (RevenueCat public key missing). Plans cannot be purchased yet.</Notice> : null}
      {ready && packages.length === 0 ? <Notice kind="warning">No products are available from the store yet. Product IDs must be created in App Store Connect / Google Play and attached to a RevenueCat offering.</Notice> : null}
      {packages.map((p) => {
        const meta = products.data?.find((x) => x.storeProductId === p.product.identifier);
        return (
          <Card key={p.identifier} mode="outlined">
            <Card.Title title={p.product.title} subtitle={p.product.priceString} />
            <Card.Content>
              <Text variant="bodySmall">{meta?.kind === 'CONSUMABLE' ? `${meta.records} additional records. Does not add devices or staff. Never expires.` : meta ? `${meta.records} records / month, ${meta.planCode} limits, 90-day proof-image retention.` : p.product.description}</Text>
            </Card.Content>
            <Card.Actions><Button mode="contained" disabled={busy} loading={busy} onPress={() => void buy(p)} style={{ minHeight: TOUCH_TARGET }}>Buy</Button></Card.Actions>
          </Card>
        );
      })}
      {apiKey ? <Button onPress={() => void restore()} disabled={busy}>Restore purchases</Button> : null}

      <Text variant="titleMedium" style={{ marginTop: 8 }}>Ledger</Text>
      {ledger.data?.slice(0, 50).map((e) => (
        <Row key={e.id} label={`${manilaTime(e.at)} · ${e.kind.toLowerCase().replace(/_/g, ' ')}`} value={`${e.delta > 0 ? '+' : ''}${e.delta}`} />
      ))}
    </Screen>
  );
}
