import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { Button, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { APP_VERSION } from '@/lib/env';
import { listDrafts } from '@/lib/drafts';
import { useSession } from '@/lib/session';
import { Group, ListRow, Notice, Screen, ScreenTitle } from '@/components/ui';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { SPACING, TOUCH_TARGET } from '@/theme';

/** Privacy-safe diagnostics: never includes proof images, notification text, or payer data. */
function diagnosticsPayload(
  version: string,
  role: string | null,
  workspaceName: string | null,
  collector: CollectorStatus | null,
  draftCount: number,
): string {
  const lines = [
    `PayTsek ${version} (${Platform.OS})`,
    `Workspace: ${workspaceName ?? '(none)'} (Role: ${role ?? '(none)'})`,
    '',
    'Collector status:',
    `  Configured: ${collector?.configured ?? 'no'}`,
    `  Notification access: ${collector?.notificationAccessGranted ?? 'no'}`,
    `  Listener connected: ${collector?.listenerConnected ?? 'no'}`,
    `  Enabled wallets: ${(collector?.enabledProviders ?? []).join(', ') || 'none'}`,
    `  Dropped events: ${(collector as any)?.droppedEventCount ?? 0}`,
    '',
    `Pending drafts: ${draftCount}`,
  ];
  return lines.join('\n');
}

export default function ReportProblem() {
  const router = useRouter();
  const theme = useTheme();
  const { workspace } = useSession();
  const role = workspace?.role ?? null;
  const workspaceName = workspace?.name ?? null;
  const [collector, setCollector] = useState<CollectorStatus | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        setCollector(await PaymentCollector.getStatus());
      }
      if (workspace) {
        const drafts = await listDrafts(workspace.id, true);
        setDraftCount(drafts.length);
      }
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const sendReport = useCallback(() => {
    const payload = diagnosticsPayload(APP_VERSION, role, workspaceName, collector, draftCount);
    const body = encodeURIComponent(
      `Problem:\n\n[describe what happened]\n\n---\nDiagnostics:\n${payload}`,
    );
    const subject = encodeURIComponent('PayTsek problem report');
    void Linking.openURL(`mailto:support@paytsek.online?subject=${subject}&body=${body}`);
    setSnack('Opening your email app…');
  }, [collector, draftCount, role, workspaceName]);

  return (
    <Screen>
      <ScreenTitle
        title="Report a problem"
        subtitle="Send diagnostics to help us fix the issue. No proof images or payment details are included."
      />

      {loading ? (
        <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Gathering diagnostics…
          </Text>
        </View>
      ) : (
        <>
          <Group title="What we include">
            <ListRow icon="information-outline" title="App version & platform" />
            <ListRow icon="office-building-outline" title="Workspace name & your role" />
            <ListRow icon="bell-ring-outline" title="Collector status & enabled wallets" />
            <ListRow icon="file-document-outline" title={`Pending drafts (${draftCount})`} />
          </Group>

          <Group title="What we never include">
            <ListRow icon="image-off-outline" title="Proof images" />
            <ListRow icon="bell-off-outline" title="Notification text" />
            <ListRow icon="account-off-outline" title="Payer names or phone numbers" />
          </Group>

          <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.lg }}>
            <Button
              mode="contained"
              onPress={sendReport}
              style={{ minHeight: TOUCH_TARGET }}
              accessibilityLabel="Send problem report via email"
            >
              Send report via email
            </Button>
          </View>

          <Notice kind="info">
            This opens your default email app with a pre-filled message to support@paytsek.online.
          </Notice>
        </>
      )}

      <Portal>
        <Snackbar visible={snack !== null} duration={2500} onDismiss={() => setSnack(null)}>
          {snack}
        </Snackbar>
      </Portal>
    </Screen>
  );
}
