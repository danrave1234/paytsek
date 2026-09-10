import type { WorkspaceSummary } from '@paytsek/contracts';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Divider, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { Notice, Screen, ScreenTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { SPACING, TOUCH_TARGET } from '@/theme';

export default function Workspaces() {
  const theme = useTheme();
  const { workspaces, selectWorkspace, refreshWorkspaces, signOut, session } = useSession();
  const [name, setName] = useState('');
  const [display, setDisplay] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const ws = await api<WorkspaceSummary>('/v1/workspaces', { method: 'POST', noWorkspace: true, body: { name, timezone: 'Asia/Manila', ownerDisplayName: display } });
      await refreshWorkspaces();
      await selectWorkspace(ws.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const accept = async () => {
    setBusy(true); setError(null);
    try {
      const ws = await api<WorkspaceSummary>('/v1/workspaces/invites/accept', { method: 'POST', noWorkspace: true, body: { inviteToken: invite.trim(), displayName: display || undefined } });
      await refreshWorkspaces();
      await selectWorkspace(ws.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <ScreenTitle title="Choose a workspace" subtitle={`Signed in as ${session?.user.email ?? ''}`} />
      {workspaces.map((w) => (
        <Card key={w.id} mode="contained" onPress={() => void selectWorkspace(w.id)} accessibilityRole="button" style={{ backgroundColor: theme.colors.surface }}>
          <Card.Title
            title={w.name}
            subtitle={`${w.role === 'OWNER' ? 'Owner' : 'Cashier'} · ${w.planCode} plan`}
            left={() => <Icon source="store-outline" size={24} color={theme.colors.primary} />}
            right={() => <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />}
          />
        </Card>
      ))}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Divider style={{ marginVertical: SPACING.sm }} />
      <Text variant="titleMedium">Create a new workspace</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>One workspace per business. Timezone defaults to Asia/Manila.</Text>
      <TextInput label="Business name" mode="outlined" value={name} onChangeText={setName} />
      <TextInput label="Your display name" mode="outlined" value={display} onChangeText={setDisplay} />
      <Button mode="contained" icon="store-plus-outline" disabled={busy || !name || !display} loading={busy} onPress={create} style={{ minHeight: TOUCH_TARGET }}>Create workspace</Button>
      <Divider style={{ marginVertical: SPACING.sm }} />
      <Text variant="titleMedium">Join with an invite</Text>
      <TextInput label="Invite code" mode="outlined" autoCapitalize="none" value={invite} onChangeText={setInvite} />
      <Button mode="contained-tonal" icon="account-multiple-plus-outline" disabled={busy || invite.trim().length < 16} onPress={accept} style={{ minHeight: TOUCH_TARGET }}>Join workspace</Button>
      <View style={{ height: SPACING.sm }} />
      <Button icon="logout" onPress={() => void signOut()}>Sign out</Button>
    </Screen>
  );
}
