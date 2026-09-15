import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
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

  useEffect(() => {
    if (!session || !workspace) return;
    void getNotificationPreferences(session.user.id, workspace.id).then(setPreferences);
  }, [session, workspace]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void PaymentCollector.getStatus().then(setCollector).catch(() => {});
  }, []);

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
      const pesos = ((result.amountCentavos ?? 0) / 100).toFixed(2);
      setTestNotice(`Test sent: \u20b1${pesos}. If listening works it appears in the Notification inbox within a minute \u2014 scan a proof for the same amount to see a Possible match.`);
    } catch (sendError) {
      setTestError((sendError as Error).message);
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
            subtitle={testBusy ? 'Sending\u2026' : 'Posts a GCash-style incoming-payment notification on this phone'}
            onPress={testBusy ? undefined : () => void sendTest()}
          />
        </Group>
      ) : null}
      {testNotice ? <Notice kind="info">{testNotice}</Notice> : null}
      {testError ? <Notice kind="error">{testError}</Notice> : null}
    </Screen>
  );
}
