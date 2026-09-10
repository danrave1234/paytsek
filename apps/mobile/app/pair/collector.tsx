import type { AcceptPairingResponse } from '@paytsek/contracts';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, Checkbox, Text, TextInput, useTheme } from 'react-native-paper';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { Notice, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { activateCollector, collectorStatus, deactivateCollector, getCollectorBinding, type CollectorBinding } from '@/lib/collector';
import { getInstallId, osVersion, platform } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { lastSeen } from '@/lib/format';
import { TOUCH_TARGET } from '@/theme';
import { useIsOwner } from '@/lib/session';
import { queryClient } from '@/lib/queries';

type Step = 'intro' | 'code' | 'waiting' | 'consent' | 'access' | 'done';

/**
 * Android payment-phone flow. Works without a user session on this phone.
 * The phone shows workspace/source/capability before anything is enabled, the
 * owner approves remotely, and notification access is requested only after the
 * user has read what is and is not collected.
 */
export default function PairCollector() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ c?: string; ownerApproval?: string }>();
  const isOwner = useIsOwner();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<CollectorBinding | null>(null);
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [code, setCode] = useState(params.c ?? '');
  const [accepted, setAccepted] = useState<AcceptPairingResponse | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [consent, setConsent] = useState({ personal: false, shared: false, noOtp: false });
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => { setExisting(await getCollectorBinding()); setStatus(await collectorStatus()); };
  useEffect(() => { void refresh(); }, []);

  // Poll for owner approval.
  useEffect(() => {
    if (step !== 'waiting' || !accepted) return;
    const t = setInterval(async () => {
      try {
        const r = await api<AcceptPairingResponse>(`/v1/pairing/${accepted.pairingSessionId}/status?deviceInstallId=${await getInstallId()}&code=${encodeURIComponent(code)}`, { anonymous: true });
        if (r.state === 'REJECTED' || r.state === 'EXPIRED') { setError(`Pairing ${r.state.toLowerCase()} by the owner.`); setStep('code'); }
        if (r.collectorCredential) { setCredential(r.collectorCredential); setAccepted(r); setStep('consent'); }
      } catch (e) { setError((e as Error).message); }
    }, 3000);
    return () => clearInterval(t);
  }, [step, accepted, code]);

  if (Platform.OS !== 'android') {
    return <Screen><Notice kind="warning">Only an Android phone can act as the payment phone. iPhone does not allow apps to read other apps' notifications. Use this iPhone to scan and review, and connect an Android phone that receives your GCash notifications.</Notice></Screen>;
  }

  const submitCode = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const apps = await PaymentCollector.detectProviderApps();
      const r = await api<AcceptPairingResponse>('/v1/pairing/accept', {
        method: 'POST', anonymous: true,
        body: { code: code.trim(), deviceInstallId: await getInstallId(), platform, appVersion: APP_VERSION, osVersion, detectedProviderApps: apps.filter((a) => a.installed).map((a) => ({ provider: a.provider, packageName: a.packageName, versionName: a.versionName ?? undefined, versionCode: a.versionCode ?? undefined, signingCertSha256: a.signingCertSha256 ?? undefined })) },
      });
      setAccepted(r);
      if (params.ownerApproval === '1' && isOwner) {
        await api('/v1/pairing/approve', { method: 'POST', body: { pairingSessionId: r.pairingSessionId, approve: true } });
        void queryClient.invalidateQueries({ queryKey: ['devices'] });
        void queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      setStep('waiting');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const finishConsent = async () => {
    if (!accepted || !credential || !accepted.deviceId) return;
    await activateCollector({ workspaceId: '', workspaceName: accepted.workspaceName, sourceLabel: accepted.sourceLabel, provider: accepted.provider, deviceId: accepted.deviceId, pairedAt: new Date().toISOString() }, credential);
    setCredential(null); // never keep the secret in JS memory longer than needed
    setStep('access');
    await refresh();
  };

  if (existing && step === 'intro') {
    return (
      <Screen>
        <Card mode="outlined">
          <Card.Title title="This phone is a payment phone" subtitle={`${existing.workspaceName} · ${existing.sourceLabel} (${existing.provider})`} />
          <Card.Content>
            <Row label="Notification access" value={status?.notificationAccessGranted ? 'Granted' : 'Not granted'} />
            <Row label="Listener" value={status?.listenerConnected ? 'Connected' : 'Disconnected'} />
            <Row label="Pending uploads" value={String(status?.pendingUploadCount ?? 0)} />
            <Row label="Last event seen" value={status?.lastObservedEventAt ? lastSeen(status.lastObservedEventAt) : 'None yet'} />
            <Row label="Last upload" value={status?.lastUploadAt ? lastSeen(status.lastUploadAt) : 'None yet'} />
            {status?.lastUploadError ? <Notice kind="warning">Upload issue: {status.lastUploadError}{status.lastUploadError === 'COLLECTOR_CREDENTIAL_REVOKED' ? ' — the owner revoked this phone; pair again to continue.' : ''}</Notice> : null}
            {!status?.notificationAccessGranted ? <Notice kind="error">Notification access is off. Nothing is collected until you turn it on.</Notice> : null}
            {status && status.pendingUploadCount > 200 ? <Notice kind="warning">Large upload backlog. Check internet connectivity; the queue is bounded and oldest items may be evicted.</Notice> : null}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => PaymentCollector.openNotificationAccessSettings()}>Notification settings</Button>
            <Button onPress={() => void PaymentCollector.setPaused(!status?.paused).then(refresh)}>{status?.paused ? 'Resume' : 'Pause'}</Button>
            <Button onPress={() => void PaymentCollector.flushNow().then(refresh)}>Upload now</Button>
          </Card.Actions>
        </Card>
        <Text variant="bodySmall" style={{ opacity: 0.7 }}>Unknown notification formats seen: {status?.unknownTemplateCount ?? 0} (counted only; content never stored).</Text>
        <Button textColor={theme.colors.error} onPress={() => void deactivateCollector().then(refresh)}>Stop collecting and unpair this phone</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      {step === 'intro' ? (
        <>
          <Text variant="titleMedium">Before you start</Text>
          <Text variant="bodyMedium">Use the Android phone where your receiving wallet is installed. PayTsek reads supported incoming-payment notifications for the paired account and shares payment details with your workspace. Employee scanner phones do not need this permission.</Text>
          <Text variant="bodyMedium">Personal payments to the same wallet source may also appear in the owner’s inbox. Employees only see limited matching details for their own scans. OTPs and unsupported messages are not payment evidence.</Text>
          <Button mode="contained" onPress={() => setStep('code')} style={{ minHeight: TOUCH_TARGET }}>I understand, enter code</Button>
        </>
      ) : null}
      {step === 'code' ? (
        <>
          <TextInput label="Pairing code from the owner" mode="outlined" autoCapitalize="characters" value={code} onChangeText={setCode} />
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button mode="contained" onPress={() => void submitCode()} loading={busy} disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 10} style={{ minHeight: TOUCH_TARGET }}>Continue</Button>
        </>
      ) : null}
      {step === 'waiting' && accepted ? (
        <Card mode="outlined">
          <Card.Title title="Waiting for the owner to approve" />
          <Card.Content>
            <Row label="Workspace" value={accepted.workspaceName} />
            <Row label="Payment source" value={`${accepted.provider} notifications on this phone`} />
            <Row label="Role of this phone" value={accepted.requestedCapability === 'BOTH' ? 'Collect notifications + scan' : 'Collect notifications only'} />
            <Text variant="bodySmall" style={{ marginTop: 8, opacity: 0.7 }}>Ask the owner to tap Approve in their app. If this is not the workspace you expected, close this screen.</Text>
          </Card.Content>
        </Card>
      ) : null}
      {step === 'consent' && accepted ? (
        <>
          <Text variant="titleMedium">Approved. Confirm sharing</Text>
          <Checkbox.Item label={`I know that supported incoming-payment notifications from ${accepted.provider}, including personal payments, will be visible to the workspace owner.`} status={consent.personal ? 'checked' : 'unchecked'} onPress={() => setConsent({ ...consent, personal: !consent.personal })} />
          <Checkbox.Item label="I understand only positive incoming-payment notifications are uploaded; OTPs, security prompts, and unknown messages are dropped on this phone." status={consent.noOtp ? 'checked' : 'unchecked'} onPress={() => setConsent({ ...consent, noOtp: !consent.noOtp })} />
          <Checkbox.Item label="I understand collection can stop if the phone is off, force-stopped, or access is revoked, and that a match is not a bank verification." status={consent.shared ? 'checked' : 'unchecked'} onPress={() => setConsent({ ...consent, shared: !consent.shared })} />
          <Button mode="contained" disabled={!consent.personal || !consent.noOtp || !consent.shared} onPress={() => void finishConsent()} style={{ minHeight: TOUCH_TARGET }}>Enable collection</Button>
        </>
      ) : null}
      {step === 'access' ? (
        <>
          <Text variant="titleMedium">Turn on notification access</Text>
          <Text variant="bodyMedium">Android will show the system "Notification access" page. Enable PayTsek there, then come back. You can revoke it any time from the same page.</Text>
          <Button mode="contained" onPress={() => PaymentCollector.openNotificationAccessSettings()} style={{ minHeight: TOUCH_TARGET }}>Open notification access settings</Button>
          <Button onPress={() => void refresh().then(() => setStep('intro'))}>I've enabled it</Button>
        </>
      ) : null}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
