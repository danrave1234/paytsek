import React, { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Switch } from 'react-native-paper';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { Group, ListRow, Notice, Screen } from '@/components/ui';
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences';
import { useSession } from '@/lib/session';

export default function Notifications() {
  const { session, workspace } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collector, setCollector] = useState<CollectorStatus | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{ id: string; deadline: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(useCallback(() => { setIsFocused(true); return () => setIsFocused(false); }, []));

  useEffect(() => {
    if (!session || !workspace) return;
    void getNotificationPreferences(session.user.id, workspace.id).then(setPreferences);
  }, [session, workspace]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void PaymentCollector.getStatus().then(setCollector).catch(() => {});
  }, []);

  useEffect(() => {
    if (!diagnostic || !isFocused) return;
    let active = true;
    const check = async () => {
      if (AppState.currentState !== 'active') return;
      if (Date.now() > diagnostic.deadline) {
        setDiagnostic(null);
        setTestBusy(false);
        setTestError('No acknowledgment yet. Check notification access and battery settings. This check cannot guarantee wallet notification delivery.');
        return;
      }
      try {
        const status = await PaymentCollector.getStatus();
        if (!active) return;
        setCollector(status);
        if (status.lastDiagnosticId === diagnostic.id) {
          setDiagnostic(null);
          setTestBusy(false);
          setTestNotice('The Android listener received this local check. No payment record or matching evidence was created. Wallet delivery and uploads are separate checks.');
        }
      } catch {
        // The bounded check continues; no native error details enter the UI/logs.
      }
    };
    void check();
    const timer = setInterval(() => void check(), 1_000);
    return () => { active = false; clearInterval(timer); };
  }, [diagnostic, isFocused]);

  const sendTest = async () => {
    if (testBusy) return;
    setTestBusy(true);
    setTestNotice(null);
    setTestError(null);
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setTestError('Android blocked the test: allow PayTsek to show notifications, then try again.');
          return;
        }
      }
      const result = await PaymentCollector.postTestNotification();
      if (!result.posted) {
        setTestError(result.reason === 'PERMISSION'
          ? 'Android blocked the test: allow PayTsek to show notifications, then try again.'
          : 'Could not post the test notification on this phone.');
        return;
      }
      if (result.diagnosticId) {
        setDiagnostic({ id: result.diagnosticId, deadline: Date.now() + 20_000 });
        setTestNotice('Local check sent. Waiting for the Android listener…');
      } else {
        setTestError('Update the app to use the isolated listener check.');
      }
    } catch {
      setTestError('Could not run the local listener check.');
    } finally {
      setTestBusy(false);
    }
  };

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || !session || !workspace) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setError(null);
    try {
      await setNotificationPreferences(session.user.id, workspace.id, next);
    } catch (updateError) {
      setPreferences(previous);
      setError((updateError as Error).message);
    }
  };

  return (
    <Screen>
      <Notice kind="info">These alerts appear inside PayTsek and never include wallet notification text.</Notice>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Group title="Alert preferences">
        <ListRow icon="clipboard-alert-outline" title="Reviews needed" right={<Switch value={preferences?.reviewRequired ?? true} onValueChange={(value) => void update('reviewRequired', value)} />} />
        <ListRow icon="cellphone-alert" title="Payment phone health" right={<Switch value={preferences?.paymentPhoneHealth ?? true} onValueChange={(value) => void update('paymentPhoneHealth', value)} />} />
        <ListRow icon="cloud-alert-outline" title="Scan sync issues" right={<Switch value={preferences?.syncIssues ?? true} onValueChange={(value) => void update('syncIssues', value)} />} />
      </Group>
      {collector?.configured ? (
        <Group title="Test the listener">
          <ListRow
            icon="bell-ring-outline"
            title="Send test notification"
            subtitle={testBusy || diagnostic ? 'Checking…' : 'Local diagnostic only; never creates payment evidence'}
            onPress={testBusy || diagnostic ? undefined : () => void sendTest()}
          />
        </Group>
      ) : null}
      {testNotice ? <Notice kind="info">{testNotice}</Notice> : null}
      {testError ? <Notice kind="error">{testError}</Notice> : null}
    </Screen>
  );
}
