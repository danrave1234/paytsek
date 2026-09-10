import React, { useEffect, useMemo, useState } from 'react';
import { Switch, Text, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Screen } from '@/components/ui';
import { countDrafts } from '@/lib/drafts';
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/lib/notification-preferences';
import { useDevices, useHome } from '@/lib/queries';
import { useSession } from '@/lib/session';

type Alert = { id: string; icon: string; title: string; subtitle: string; visible: boolean };

export default function Notifications() {
  const theme = useTheme();
  const { session, workspace } = useSession();
  const home = useHome();
  const devices = useDevices();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState(0);

  useEffect(() => {
    if (!session || !workspace) return;
    void getNotificationPreferences(session.user.id, workspace.id).then(setPreferences);
    void countDrafts(workspace.id).then(setPendingDrafts);
  }, [session, workspace]);

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || !session || !workspace) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await setNotificationPreferences(session.user.id, workspace.id, next);
  };

  const alerts = useMemo<Alert[]>(() => {
    const review = home.data?.today.reviewRequiredCount ?? 0;
    const stale = (devices.data ?? []).filter((device) => device.capability !== 'SCANNER' && (device.status !== 'ACTIVE' || device.notificationAccessGranted === false || device.listenerConnected === false));
    return [
      { id: 'review', icon: 'clipboard-alert-outline', title: 'Records need review', subtitle: `${review} record${review === 1 ? '' : 's'} need a decision.`, visible: !!preferences?.reviewRequired && review > 0 },
      { id: 'phone', icon: 'cellphone-alert', title: 'Payment phone needs attention', subtitle: stale.length ? `${stale.length} payment phone${stale.length === 1 ? '' : 's'} need attention.` : 'All connected payment phones are reporting normally.', visible: !!preferences?.paymentPhoneHealth && stale.length > 0 },
      { id: 'sync', icon: 'cloud-alert-outline', title: 'Scans waiting to sync', subtitle: `${pendingDrafts} receipt${pendingDrafts === 1 ? '' : 's'} will upload when the connection returns.`, visible: !!preferences?.syncIssues && pendingDrafts > 0 },
    ];
  }, [devices.data, home.data, pendingDrafts, preferences]);

  return (
    <Screen>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>Choose which operational alerts appear in PayTsek.</Text>
      <Notice kind="info">Alerts stay inside PayTsek in this release. They are based on live workspace data and do not expose wallet notification text.</Notice>
      <Group title="Current alerts">
        {alerts.filter((alert) => alert.visible).map((alert) => <ListRow key={alert.id} icon={alert.icon} title={alert.title} subtitle={alert.subtitle} />)}
        {!alerts.some((alert) => alert.visible) ? <ListRow icon="check-circle-outline" title="All caught up" subtitle="There are no enabled alerts right now." /> : null}
      </Group>
      <Group title="Alert preferences">
        <ListRow icon="clipboard-alert-outline" title="Reviews needed" subtitle="Show when a saved record needs a decision." right={<Switch value={preferences?.reviewRequired ?? true} onValueChange={(value) => void update('reviewRequired', value)} />} />
        <ListRow icon="cellphone-alert" title="Payment phone health" subtitle="Show when listener access, connection, or device state needs attention." right={<Switch value={preferences?.paymentPhoneHealth ?? true} onValueChange={(value) => void update('paymentPhoneHealth', value)} />} />
        <ListRow icon="cloud-alert-outline" title="Scan sync issues" subtitle="Show when saved scans are waiting on this phone." right={<Switch value={preferences?.syncIssues ?? true} onValueChange={(value) => void update('syncIssues', value)} />} />
      </Group>
    </Screen>
  );
}
