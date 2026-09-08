import React, { useState } from 'react';
import { Share } from 'react-native';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useIsOwner, useSession } from '@/lib/session';

export default function Privacy() {
  const isOwner = useIsOwner();
  const { workspace, signOut, refreshWorkspaces, selectWorkspace } = useSession();
  const [dialog, setDialog] = useState<'account' | 'workspace' | null>(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const exportData = async () => {
    const data = await api<Record<string, unknown>>('/v1/me/privacy-export', { noWorkspace: true });
    await Share.share({ message: JSON.stringify(data, null, 2), title: 'PayRecord personal data export' });
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
      <Card mode="outlined">
        <Card.Title title="What PayRecord collects" />
        <Card.Content style={{ gap: 6 }}>
          <Text variant="bodySmall">• Receipt images you capture or import (location EXIF removed) and the fields read from them.</Text>
          <Text variant="bodySmall">• On a paired Android payment phone only: amount, masked sender, reference (if shown) and time of positive incoming-payment notifications from the wallet apps you enabled. OTPs, security prompts, outgoing payments, promos and unknown messages are dropped on the phone and never uploaded.</Text>
          <Text variant="bodySmall">• Never: GPS, contacts, installed-app inventory, wallet balance, MPIN/OTP/login, IMEI or other hardware identifiers.</Text>
        </Card.Content>
      </Card>
      <Card mode="outlined">
        <Card.Title title="Retention (operational recordkeeping, not a tax archive)" />
        <Card.Content>
          <Row label="Unmatched notifications" value="7 days" />
          <Row label="Receipt images (Free)" value="30 days" />
          <Row label="Receipt images (paid / with credits)" value="90 days" />
          <Row label="Structured records & audit" value="12 months" />
          <Row label="Export files" value="24 hours" />
        </Card.Content>
      </Card>
      <Notice kind="info">A notification match means PayRecord saw a matching notification on your phone. It is not a confirmation from GCash, GoTyme, Maya or any bank.</Notice>
      <Button mode="outlined" onPress={() => void exportData()}>Export my personal data</Button>
      {isOwner ? <Button mode="outlined" textColor="#B3261E" onPress={() => setDialog('workspace')}>Delete workspace "{workspace?.name}"</Button> : null}
      <Button mode="outlined" textColor="#B3261E" onPress={() => setDialog('account')}>Delete my account</Button>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <Portal>
        <Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{dialog === 'workspace' ? 'Delete workspace' : 'Delete account'}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text variant="bodySmall">{dialog === 'workspace' ? 'All records, images, notifications, devices and billing links for this workspace will be removed. Devices are revoked immediately; files are purged by the retention job.' : 'Your profile and memberships are removed. Business records you created stay with the workspace without your name. Sole owners must transfer ownership or delete the workspace first.'}</Text>
            <TextInput label="Type DELETE to confirm" mode="outlined" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Cancel</Button>
            <Button textColor="#B3261E" disabled={confirm !== 'DELETE'} onPress={() => void run()}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
