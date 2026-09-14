import React, { useEffect, useState } from 'react';
import { Switch } from 'react-native-paper';
import { Group, ListRow, Notice, Screen } from '@/components/ui';
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences';
import { useSession } from '@/lib/session';

export default function Notifications() {
  const { session, workspace } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !workspace) return;
    void getNotificationPreferences(session.user.id, workspace.id).then(setPreferences);
  }, [session, workspace]);

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
    </Screen>
  );
}
