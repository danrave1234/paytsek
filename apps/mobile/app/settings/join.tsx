import type { WorkspaceSummary } from '@paytsek/contracts';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { TOUCH_TARGET } from '@/theme';

/**
 * A cashier joins an owner's store with the invite code from Settings → Team.
 * PayTsek then works in that store; there is no workspace picker to manage.
 */
export default function JoinTeam() {
  const theme = useTheme();
  const router = useRouter();
  const { session, refreshWorkspaces } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const metadataName = session?.user.user_metadata?.full_name;
      const displayName = typeof metadataName === 'string' && metadataName.trim()
        ? metadataName.trim()
        : session?.user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Cashier';
      const joined = await api<WorkspaceSummary>('/v1/workspaces/invites/accept', {
        method: 'POST',
        noWorkspace: true,
        body: { inviteToken: code.trim(), displayName },
      });
      await refreshWorkspaces(joined.id);
      haptics.success();
      router.replace('/(tabs)');
    } catch (joinError) {
      haptics.warning();
      setError((joinError as Error).message || 'That invite code could not be used.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        Ask the store owner for an invite from Settings → Team. After joining, PayTsek records payments for that store.
      </Text>
      <TextInput label="Invite code" mode="outlined" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button mode="contained" loading={busy} disabled={busy || code.trim().length < 16} onPress={() => void join()} contentStyle={{ minHeight: TOUCH_TARGET }}>
        Join
      </Button>
    </Screen>
  );
}
