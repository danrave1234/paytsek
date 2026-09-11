import type { AcceptPairingResponse } from '@paytsek/contracts';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { ActivityIndicator, Button, Checkbox, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { Notice, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { activateCollector, collectorStatus, deactivateCollector, getCollectorBinding, type CollectorBinding } from '@/lib/collector';
import { getInstallId, osVersion, platform } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { queryClient } from '@/lib/queries';
import { useIsOwner } from '@/lib/session';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

type Step = 'code' | 'waiting' | 'consent' | 'access';

export default function PairCollector() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ c?: string; ownerApproval?: string }>();
  const isOwner = useIsOwner();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<CollectorBinding | null>(null);
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(params.c ?? '');
  const [accepted, setAccepted] = useState<AcceptPairingResponse | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setExisting(await getCollectorBinding());
    setStatus(await collectorStatus());
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (step !== 'waiting' || !accepted) return;
    const timer = setInterval(async () => {
      try {
        const next = await api<AcceptPairingResponse>(`/v1/pairing/${accepted.pairingSessionId}/status?deviceInstallId=${await getInstallId()}&code=${encodeURIComponent(code)}`, { anonymous: true });
        if (next.state === 'REJECTED' || next.state === 'EXPIRED') {
          setError('This pairing code is no longer active.');
          setStep('code');
        } else if (next.collectorCredential) {
          setCredential(next.collectorCredential);
          setAccepted(next);
          setStep('consent');
        }
      } catch {
        // Keep checking quietly through brief network interruptions.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [step, accepted, code]);

  if (Platform.OS !== 'android') {
    return <Screen><Notice kind="info">Connect the Android phone that receives the payment notifications.</Notice></Screen>;
  }

  const submitCode = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const apps = await PaymentCollector.detectProviderApps();
      const next = await api<AcceptPairingResponse>('/v1/pairing/accept', {
        method: 'POST',
        anonymous: true,
        body: {
          code: code.trim(),
          deviceInstallId: await getInstallId(),
          platform,
          appVersion: APP_VERSION,
          osVersion,
          detectedProviderApps: apps.filter((app) => app.installed).map((app) => ({
            provider: app.provider,
            packageName: app.packageName,
            versionName: app.versionName ?? undefined,
            versionCode: app.versionCode ?? undefined,
            signingCertSha256: app.signingCertSha256 ?? undefined,
          })),
        },
      });
      setAccepted(next);
      if (params.ownerApproval === '1' && isOwner) {
        await api('/v1/pairing/approve', { method: 'POST', body: { pairingSessionId: next.pairingSessionId, approve: true } });
        void queryClient.invalidateQueries({ queryKey: ['devices'] });
        void queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      setStep('waiting');
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finishConsent = async () => {
    if (!accepted || !credential || !accepted.deviceId) return;
    await activateCollector({
      workspaceId: '',
      workspaceName: accepted.workspaceName,
      sourceLabel: accepted.sourceLabel,
      provider: accepted.provider,
      deviceId: accepted.deviceId,
      pairedAt: new Date().toISOString(),
    }, credential);
    setCredential(null);
    setStep('access');
    await refresh();
  };

  if (existing && step === 'code') {
    const ready = status?.notificationAccessGranted && !status?.paused;
    return (
      <Screen scroll={false} style={styles.centered}>
        <View style={[styles.statusIcon, { backgroundColor: ready ? theme.colors.primaryContainer : theme.colors.errorContainer }]}>
          <Icon source={ready ? 'check' : 'bell-off-outline'} size={34} color={ready ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer} />
        </View>
        <Text variant="headlineSmall" style={styles.centerText}>{ready ? 'GCash monitoring is on' : 'Notifications are off'}</Text>
        <Text variant="bodyMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>{existing.sourceLabel}</Text>
        {!status?.notificationAccessGranted ? (
          <Button mode="contained" onPress={() => PaymentCollector.openNotificationAccessSettings()} contentStyle={styles.actionContent}>Allow notification access</Button>
        ) : status?.paused ? (
          <Button mode="contained" onPress={() => void PaymentCollector.setPaused(false).then(refresh)} contentStyle={styles.actionContent}>Resume</Button>
        ) : null}
        <Button textColor={theme.colors.error} onPress={() => void deactivateCollector().then(refresh)}>Unpair phone</Button>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={styles.centered}>
      {step === 'code' ? (
        <>
          <Text variant="headlineSmall" style={styles.centerText}>Connect payment phone</Text>
          <TextInput label="Pairing code" mode="outlined" autoCapitalize="characters" value={code} onChangeText={setCode} style={styles.fullWidth} />
          {error ? <Notice kind="error">{error}</Notice> : null}
          <Button mode="contained" onPress={() => void submitCode()} loading={busy} disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 10} contentStyle={styles.actionContent} style={styles.fullWidth}>Continue</Button>
        </>
      ) : null}

      {step === 'waiting' && accepted ? (
        <>
          <ActivityIndicator size="large" />
          <Text variant="headlineSmall" style={styles.centerText}>Waiting for approval</Text>
          <Text variant="bodyMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>{accepted.workspaceName} · {accepted.sourceLabel}</Text>
        </>
      ) : null}

      {step === 'consent' && accepted ? (
        <>
          <View style={[styles.statusIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="bell-check-outline" size={34} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="headlineSmall" style={styles.centerText}>Approved</Text>
          <Checkbox.Item
            label={`Share supported incoming ${accepted.provider} payment notifications with ${accepted.workspaceName}. OTPs are never collected.`}
            status={consent ? 'checked' : 'unchecked'}
            onPress={() => setConsent((checked) => !checked)}
            style={styles.fullWidth}
            labelStyle={{ flexShrink: 1 }}
          />
          <Button mode="contained" disabled={!consent} onPress={() => void finishConsent()} contentStyle={styles.actionContent} style={styles.fullWidth}>Enable</Button>
        </>
      ) : null}

      {step === 'access' ? (
        <>
          <Text variant="headlineSmall" style={styles.centerText}>One last permission</Text>
          <Button mode="contained" onPress={() => PaymentCollector.openNotificationAccessSettings()} contentStyle={styles.actionContent} style={styles.fullWidth}>Allow notification access</Button>
          <Button onPress={() => void refresh().then(() => setStep('code'))}>Done</Button>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.lg, paddingBottom: SPACING.xxxl } as const,
  centerText: { textAlign: 'center' } as const,
  fullWidth: { width: '100%', maxWidth: 420 } as const,
  statusIcon: { width: 72, height: 72, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' } as const,
  actionContent: { minHeight: TOUCH_TARGET } as const,
};
