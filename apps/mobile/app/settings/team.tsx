import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Loading, Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useMembers } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SPACING, TOUCH_TARGET } from '@/theme';

export default function Team() {
  const theme = useTheme();
  const q = useMembers();
  const qc = useQueryClient();
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [canConfirm, setCanConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ inviteToken: string; expiresAt: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['members'] });

  const send = async () => {
    setError(null);
    try {
      const r = await api<{ inviteToken: string; expiresAt: string }>('/v1/workspaces/current/invites', { method: 'POST', body: { email, role: 'CASHIER', canConfirmMatches: canConfirm } });
      setInvite(r);
      setEmail('');
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Screen>
      <Notice kind="info">Cashiers can scan and see their own records and minimal candidate details. They never see your full incoming-payment inbox, billing, or device pairing.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} retry={() => void q.refetch()} /> : null}
      {q.data?.map((m) => (
        <Card key={m.userId} mode="outlined">
          <Card.Title title={m.displayName} subtitle={`${m.email ?? ''} · ${m.role === 'OWNER' ? 'Owner' : 'Cashier'}`} />
          {m.role === 'CASHIER' ? (
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyMedium" style={{ flex: 1 }}>May confirm proposed matches</Text>
                <Switch value={m.canConfirmMatches} onValueChange={(v) => void api(`/v1/workspaces/current/members/${m.userId}`, { method: 'PATCH', body: { canConfirmMatches: v } }).then(refresh)} />
              </View>
            </Card.Content>
          ) : null}
          {m.role === 'CASHIER' && m.userId !== session?.user.id ? (
            <Card.Actions><Button textColor={theme.colors.error} onPress={() => void api(`/v1/workspaces/current/members/${m.userId}`, { method: 'DELETE' }).then(refresh)}>Remove</Button></Card.Actions>
          ) : null}
        </Card>
      ))}
      <Text variant="titleMedium" style={{ marginTop: SPACING.sm }}>Invite a cashier</Text>
      <TextInput label="Email" mode="outlined" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="bodyMedium">Allow confirming proposed matches</Text>
        <Switch value={canConfirm} onValueChange={setCanConfirm} />
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button mode="contained" onPress={() => void send()} disabled={!/\S+@\S+\.\S+/.test(email)} style={{ minHeight: TOUCH_TARGET }}>Create invite</Button>
      {invite ? (
        <Card mode="outlined">
          <Card.Title title="Invite created" subtitle="Share this code with the cashier (valid 7 days, single use)" />
          <Card.Content><Text selectable variant="bodyLarge">{invite.inviteToken}</Text></Card.Content>
          <Card.Actions><Button onPress={() => void Share.share({ message: `Join my PayTsek workspace. Open PayTsek → Join with an invite and enter: ${invite.inviteToken}` })}>Share</Button></Card.Actions>
        </Card>
      ) : null}
    </Screen>
  );
}
