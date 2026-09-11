import type { WorkspaceSummary } from '@paytsek/contracts';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, TextInput, TouchableRipple, useTheme } from 'react-native-paper';
import { Notice, Screen, ScreenTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

export default function Workspaces() {
  const theme = useTheme();
  const { workspaces, selectWorkspace, refreshWorkspaces, signOut, session } = useSession();
  const [businessName, setBusinessName] = useState('');
  const [invite, setInvite] = useState('');
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoCreateStarted = useRef(false);
  const emailName = session?.user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  const metadataName = session?.user.user_metadata?.full_name;
  const displayName = typeof metadataName === 'string' && metadataName.trim() ? metadataName.trim() : (emailName || 'Owner');

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = await api<WorkspaceSummary>('/v1/workspaces', {
        method: 'POST',
        noWorkspace: true,
        body: { name: businessName.trim() || 'My records', timezone: 'Asia/Manila', ownerDisplayName: displayName },
      });
      await refreshWorkspaces();
      await selectWorkspace(workspace.id);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session || workspaces.length || joining || autoCreateStarted.current) return;
    autoCreateStarted.current = true;
    void create();
  }, [error, joining, session, workspaces.length]);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = await api<WorkspaceSummary>('/v1/workspaces/invites/accept', {
        method: 'POST',
        noWorkspace: true,
        body: { inviteToken: invite.trim(), displayName },
      });
      await refreshWorkspaces();
      await selectWorkspace(workspace.id);
    } catch (acceptError) {
      setError((acceptError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!workspaces.length && !joining && !error) {
    return <Screen scroll={false} style={styles.center}><ActivityIndicator size="large" /></Screen>;
  }

  return (
    <Screen>
      <ScreenTitle title={workspaces.length ? 'Your records' : 'Join a team'} />

      {workspaces.map((workspace) => (
        <TouchableRipple key={workspace.id} onPress={() => void selectWorkspace(workspace.id)} borderless style={{ borderRadius: RADIUS.lg }}>
          <View style={[styles.workspace, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="wallet-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>{workspace.name}</Text>
            <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          </View>
        </TouchableRipple>
      ))}

      {error ? <Notice kind="error">Couldn’t finish setup.</Notice> : null}

      {!joining && workspaces.length ? (
        <View style={styles.form}>
          <TextInput label="Business name (optional)" mode="outlined" value={businessName} onChangeText={setBusinessName} maxLength={80} />
          <Button mode="contained" loading={busy} disabled={busy} onPress={() => void create()} contentStyle={{ minHeight: TOUCH_TARGET }}>
            Continue
          </Button>
          <Button mode="text" onPress={() => setJoining(true)}>Join with a code</Button>
        </View>
      ) : joining ? (
        <View style={styles.form}>
          <TextInput label="Invite code" mode="outlined" autoCapitalize="characters" value={invite} onChangeText={setInvite} />
          <Button mode="contained" loading={busy} disabled={busy || invite.trim().length < 16} onPress={() => void accept()} contentStyle={{ minHeight: TOUCH_TARGET }}>
            Join
          </Button>
          <Button mode="text" onPress={() => setJoining(false)}>Back</Button>
        </View>
      ) : (
        <View style={styles.form}>
          <Button
            mode="contained"
            loading={busy}
            disabled={busy}
            onPress={() => {
              autoCreateStarted.current = false;
              setError(null);
            }}
            contentStyle={{ minHeight: TOUCH_TARGET }}
          >
            Try again
          </Button>
          <Button mode="text" onPress={() => setJoining(true)}>Join with a code</Button>
        </View>
      )}

      <Button icon="logout" onPress={() => void signOut()} style={{ alignSelf: 'center' }}>Sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  workspace: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  form: { gap: SPACING.md, marginTop: SPACING.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
