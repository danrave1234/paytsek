import { PROVIDERS, PROVIDER_LABELS, type Provider, type SourceSummary } from '@payrecord/contracts';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';
import { ErrorState, Loading, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { autoMatchFlowsForReceivingProvider } from '@payrecord/receipt-parsers';
import { maskPhone } from '@/lib/format';
import { useSources } from '@/lib/queries';
import { TOUCH_TARGET } from '@/theme';

export default function Sources() {
  const q = useSources();
  const qc = useQueryClient();
  const [provider, setProvider] = useState<Provider>('GCASH');
  const [label, setLabel] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [aliases, setAliases] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['sources'] });

  const add = async () => {
    setError(null);
    try {
      await api('/v1/sources', { method: 'POST', body: { provider, label, declaredIdentifier: identifier, maskedDisplay: maskPhone(identifier), recipientAliases: aliases.split(',').map((s) => s.trim()).filter(Boolean), isDefault: (q.data?.length ?? 0) === 0 } });
      setLabel(''); setIdentifier(''); setAliases('');
      await refresh();
    } catch (e) { setError((e as Error).message); }
  };

  const patch = async (s: SourceSummary, body: Record<string, unknown>) => {
    try { await api(`/v1/sources/${s.id}`, { method: 'PATCH', body }); await refresh(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">Account association is owner-configured, not provider-verified. PayRecord cannot confirm which account a notification belongs to beyond the phone it came from.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : null}
      {q.data?.map((s) => (
        <Card key={s.id} mode="outlined">
          <Card.Title title={`${s.label}${s.isDefault ? ' · default' : ''}`} subtitle={`${PROVIDER_LABELS[s.provider]} · ${s.maskedDisplay}`} />
          <Card.Content>
            <Row label="Automatic matching" value={s.autoMatchFlows.length ? s.autoMatchFlows.join(', ') : 'Recording + manual confirmation only'} />
            <Row label="Payment phone" value={s.activeCollectorDeviceId ? 'Connected' : 'None'} />
            {s.recipientAliases.length ? <Row label="Recipient aliases" value={s.recipientAliases.join(', ')} /> : null}
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
            <Button textColor="#B3261E" onPress={() => void api(`/v1/sources/${s.id}`, { method: 'DELETE' }).then(refresh)}>Remove</Button>
          </Card.Actions>
        </Card>
      ))}

      <Text variant="titleMedium" style={{ marginTop: 8 }}>Add receiving account</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PROVIDERS.map((p) => (
          <Button
            key={p.value}
            mode={provider === p.value ? 'contained' : 'outlined'}
            onPress={() => setProvider(p.value)}
            style={{ flex: 1 }}
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
      <TextInput label="Label (e.g. Store GCash)" mode="outlined" value={label} onChangeText={setLabel} />
      <TextInput label="Account mobile number" mode="outlined" keyboardType="phone-pad" value={identifier} onChangeText={setIdentifier} />
      <TextInput label="Names shown on customer payment confirmations (comma separated)" mode="outlined" value={aliases} onChangeText={setAliases} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button mode="contained" onPress={() => void add()} disabled={!label || identifier.replace(/\D/g, '').length < 7} style={{ minHeight: TOUCH_TARGET }}>Add account</Button>
    </Screen>
  );
}
