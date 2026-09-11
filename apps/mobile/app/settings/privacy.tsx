import React, { useState } from 'react';
import { Share } from 'react-native';
import { Button, Card, Dialog, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useIsOwner, useSession } from '@/lib/session';

export default function Privacy() {
  const theme = useTheme();
  const isOwner = useIsOwner();
  const { workspace, signOut, refreshWorkspaces, selectWorkspace } = useSession();
  const [dialog, setDialog] = useState<'account' | 'workspace' | null>(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const exportData = async () => {
    const data = await api<Record<string, unknown>>('/v1/me/privacy-export', { noWorkspace: true });
    await Share.share({ message: JSON.stringify(data, null, 2), title: 'PayTsek personal data export' });
  };

  const run = async () => {
    setMsg(null);
    try {
      if (dialog === 'workspace') {
        await api('/v1/workspaces/current', { method: 'DELETE', body: { confirm: 'DELETE' } });
        await selectWorkspace(null);
        await refreshWorkspaces();
      } else {
        await api('/v1/me', { method: 'DELETE', noWorkspace: true, body: { confirm: 'DELETE' } });
        await signOut();
      }
      setDialog(null);
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
  };

  return (
    <Screen>
      <Notice kind="info">PayTsek reads payment evidence you choose and incoming-payment notifications from a connected Android phone. It never reads OTPs, passwords, contacts, or your wallet balance.</Notice>
      <Card mode="outlined">
        <List.Accordion title="Data PayTsek uses" description="Receipts and payment notifications">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="bodySmall">Receipt images you capture or import, with location metadata removed.</Text>
            <Text variant="bodySmall">Incoming amount, masked sender, reference and time from supported wallet notifications.</Text>
            <Text variant="bodySmall">Security prompts, outgoing payments, promotions and unknown messages are discarded on the phone.</Text>
          </Card.Content>
        </List.Accordion>
        <List.Accordion title="How long data is kept" description="Tap to view retention periods">
          <Card.Content>
            <Row label="Unmatched notifications" value="7 days" />
            <Row label="Receipt images" value="30–90 days" />
            <Row label="Records and history" value="12 months" />
            <Row label="Export files" value="24 hours" />
          </Card.Content>
        </List.Accordion>
      </Card>
      <Group title="Your data">
        <ListRow icon="file-export-outline" title="Export my personal data" onPress={() => void exportData()} />
      </Group>
      <Group title="Danger zone">
        {isOwner ? <ListRow icon="delete-outline" title={`Delete ${workspace?.name ?? 'workspace'}`} destructive onPress={() => setDialog('workspace')} /> : null}
        <ListRow icon="account-remove-outline" title="Delete my account" destructive onPress={() => setDialog('account')} />
      </Group>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <Portal>
        <Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{dialog === 'workspace' ? 'Delete workspace' : 'Delete account'}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text variant="bodySmall">{dialog === 'workspace' ? 'This removes its records, images, notifications, devices and billing links.' : 'This removes your profile and memberships. Business records stay with their workspace without your name.'}</Text>
            <TextInput label="Type DELETE to confirm" mode="outlined" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Cancel</Button>
            <Button textColor={theme.colors.error} disabled={confirm !== 'DELETE'} onPress={() => void run()}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
