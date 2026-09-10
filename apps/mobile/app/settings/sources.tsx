import { PROVIDERS, PROVIDER_LABELS, type Provider, type SourceSummary } from '@paytsek/contracts';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Switch, Text, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { autoMatchFlowsForReceivingProvider } from '@paytsek/receipt-parsers';
import { useSources } from '@/lib/queries';
import { SPACING, TOUCH_TARGET } from '@/theme';

export default function Sources() {
  const theme = useTheme();
  const q = useSources();
  const qc = useQueryClient();
  const [provider, setProvider] = useState<Provider>('GCASH');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['sources'] });

  const add = async () => {
    setError(null);
    try {
      // A source identifies a wallet app on the main payment phone. It is not
      // a customer or a wallet account name, so avoid collecting either here.
      await api('/v1/sources', {
        method: 'POST',
        body: {
          provider,
          label: `${PROVIDER_LABELS[provider]} on main payment phone`,
          declaredIdentifier: `main-phone:${provider}`,
          maskedDisplay: 'Main payment phone',
          recipientAliases: [],
          isDefault: (q.data?.length ?? 0) === 0,
        },
      });
      await refresh();
    } catch (e) { setError((e as Error).message); }
  };

  const patch = async (s: SourceSummary, body: Record<string, unknown>) => {
    try { await api(`/v1/sources/${s.id}`, { method: 'PATCH', body }); await refresh(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">A payment source is a wallet app on the main payment phone. If that phone receives a QR payment notification, PayTsek can process it. This is not a customer profile and it does not need customer-facing names.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : null}
      {q.data?.map((s) => (
        <Card key={s.id} mode="outlined">
          <Card.Title title={`${PROVIDER_LABELS[s.provider]} notifications${s.isDefault ? ' · default' : ''}`} subtitle="Main payment phone" />
          <Card.Content>
            <Row label="Automatic matching" value={s.autoMatchFlows.length ? s.autoMatchFlows.join(', ') : 'Recording + manual confirmation only'} />
            <Row label="Payment phone" value={s.activeCollectorDeviceId ? 'Connected' : 'None'} />
            <Row label="Notification format" value={s.autoMatchFlows.length ? 'Tested matching template available' : 'No tested matching template yet'} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
              <Text variant="bodyMedium">Pause collection</Text>
              <Switch value={s.collectionPaused} onValueChange={(v) => void patch(s, { collectionPaused: v })} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
              <Text variant="bodyMedium" style={{ flex: 1 }}>Owner must approve matches for staff records</Text>
              <Switch value={s.requireOwnerApprovalForStaffMatches} onValueChange={(v) => void patch(s, { requireOwnerApprovalForStaffMatches: v })} />
            </View>
          </Card.Content>
          <Card.Actions>
            {!s.isDefault ? <Button onPress={() => void patch(s, { isDefault: true })}>Make default</Button> : null}
            <Button textColor={theme.colors.error} onPress={() => void api(`/v1/sources/${s.id}`, { method: 'DELETE' }).then(refresh)}>Remove</Button>
          </Card.Actions>
        </Card>
      ))}

      <Text variant="titleMedium" style={{ marginTop: SPACING.sm }}>Add wallet notification source</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Choose each wallet app that receives your business’s QR payments on the paired main phone. No account number or customer name is required. PayTsek only auto-matches tested formats; unknown formats stay out of matching until reviewed.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
        {PROVIDERS.map((p) => (
          <Button
            key={p.value}
            mode={provider === p.value ? 'contained' : 'outlined'}
            onPress={() => setProvider(p.value)}
            style={{ minWidth: '45%' }}
          >
            {p.label}
          </Button>
        ))}
      </View>
      {/* Derived from the capability registry, so this stops warning by itself
          once a flow for this provider is proven and enabled. */}
      {autoMatchFlowsForReceivingProvider(provider).length === 0 ? (
        <Notice kind="warning">
          {PROVIDER_LABELS[provider]} notification matching is not enabled yet (no verified notification sample). Payments can
          still be recorded and confirmed manually.
        </Notice>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button mode="contained" onPress={() => void add()} style={{ minHeight: TOUCH_TARGET }}>Add {PROVIDER_LABELS[provider]} source</Button>
    </Screen>
  );
}
