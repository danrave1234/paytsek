import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import { ErrorState, Group, Loading, Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useMembers } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

export default function Team() {
  const theme = useTheme();
  const query = useMembers();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [canConfirm, setCanConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ inviteToken: string; expiresAt: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['members'] });

  const send = async () => {
    setError(null);
    try {
      const result = await api<{ inviteToken: string; expiresAt: string }>('/v1/workspaces/current/invites', {
        method: 'POST',
        body: { email, role: 'CASHIER', canConfirmMatches: canConfirm },
      });
      setInvite(result);
      setEmail('');
    } catch (sendError) {
      setError((sendError as Error).message);
    }
  };

  return (
    <Screen>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Cashiers can scan and see their own records. Workspace settings remain owner-only.
      </Text>
      {query.isLoading ? <Loading variant="list" label="Loading team" /> : null}
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {(query.data?.length ?? 0) > 0 ? (
        <Group title="Members">
          {query.data?.map((member) => (
            <View key={member.userId} style={styles.member}>
              <View style={styles.memberTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyLarge">{member.displayName}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {member.role === 'OWNER' ? 'Owner' : 'Cashier'}{member.email ? ` · ${member.email}` : ''}
                  </Text>
                </View>
                {member.role === 'CASHIER' && member.userId !== session?.user.id ? (
                  <Button compact textColor={theme.colors.error} onPress={() => void api(`/v1/workspaces/current/members/${member.userId}`, { method: 'DELETE' }).then(refresh)}>Remove</Button>
                ) : null}
              </View>
              {member.role === 'CASHIER' ? (
                <View style={styles.permission}>
                  <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>Can link suggested notification matches</Text>
                  <Switch value={member.canConfirmMatches} onValueChange={(value) => void api(`/v1/workspaces/current/members/${member.userId}`, { method: 'PATCH', body: { canConfirmMatches: value } }).then(refresh)} />
                </View>
              ) : null}
            </View>
          ))}
        </Group>
      ) : null}

      <View style={styles.form}>
        <Text variant="titleMedium" style={{ fontWeight: '700' }}>Invite a cashier</Text>
        <TextInput label="Email" mode="outlined" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <View style={styles.permission}>
          <Text variant="bodyMedium" style={{ flex: 1 }}>Can link suggested matches</Text>
          <Switch value={canConfirm} onValueChange={setCanConfirm} />
        </View>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button mode="contained" onPress={() => void send()} disabled={!/\S+@\S+\.\S+/.test(email)} style={{ minHeight: TOUCH_TARGET }}>Create invite</Button>
      </View>

      {invite ? (
        <View style={[styles.invite, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="titleSmall">Invite ready</Text>
            <Text selectable variant="bodyMedium">{invite.inviteToken}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Single use · expires in 7 days</Text>
          </View>
          <Button compact mode="contained-tonal" onPress={() => void Share.share({ message: `Join my PayTsek workspace. Open PayTsek → Join with an invite and enter: ${invite.inviteToken}` })}>Share</Button>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: { minHeight: 72, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.xs },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  permission: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  form: { gap: SPACING.md, paddingTop: SPACING.sm },
  invite: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: SPACING.lg },
});
