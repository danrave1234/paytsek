import { useQuery, onlineManager } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Icon, Portal, Text, useTheme } from 'react-native-paper';
import { countLegacyDrafts, recoverLegacyDrafts, type Draft } from '@/lib/drafts';
import { invalidateDrafts, queryClient } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { EMPTY_SYNC_PROGRESS, SYNC_PROGRESS_KEY, syncWorkspace, type SyncProgress } from '@/lib/sync-coordinator';
import { transactionTime } from '@/lib/format';
import { SPACING, TOUCH_TARGET } from '@/theme';
import { Notice } from './ui';

/** Sync is distinct from payment evidence. Every role sees only its own saved scans. */
export function SyncStatus({ drafts }: { drafts: Draft[] }) {
  const theme = useTheme();
  const { workspace } = useSession();
  const online = useSyncExternalStore((listener) => onlineManager.subscribe(listener), () => onlineManager.isOnline());
  const { data: progress = EMPTY_SYNC_PROGRESS } = useQuery({ queryKey: SYNC_PROGRESS_KEY,
    queryFn: () => EMPTY_SYNC_PROGRESS, initialData: EMPTY_SYNC_PROGRESS, staleTime: Infinity });
  const [legacyCount, setLegacyCount] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failed = drafts.filter((draft) => draft.syncStatus === 'FAILED').length;
  useFocusEffect(useCallback(() => {
    let active = true;
    if (workspace?.role === 'OWNER') void countLegacyDrafts(workspace.id).then((count) => { if (active) setLegacyCount(count); }).catch(() => undefined);
    else setLegacyCount(0);
    return () => { active = false; };
  }, [workspace]));

  const retry = async () => {
    if (!workspace) return;
    setError(null);
    try { await syncWorkspace(workspace); }
    catch { setError('Could not sync now. Your scans remain saved on this phone.'); }
  };
  const recover = async () => {
    if (!workspace || recovering) return;
    setRecovering(true);
    setError(null);
    try {
      await recoverLegacyDrafts(workspace.id);
      setLegacyCount(0);
      setShowRecovery(false);
      void invalidateDrafts();
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      await syncWorkspace(workspace);
    } catch { setError('Recovery needs an internet connection and current owner access. Saved scans have not been removed.'); }
    finally { setRecovering(false); }
  };
  if (!drafts.length && !legacyCount && !progress.lastSyncedAt && !error) return null;
  return (
    <View style={{ gap: SPACING.xs }}>
      {(drafts.length > 0 || progress.lastSyncedAt) ? (
        <View style={{ minHeight: TOUCH_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }} accessibilityLiveRegion="polite">
          <Icon source={!online ? 'cloud-off-outline' : failed ? 'cloud-alert-outline' : drafts.length ? 'cloud-upload-outline' : 'cloud-check-outline'} size={20} color={theme.colors.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall">{drafts.length ? `${drafts.length} saved on this phone${failed ? ` · ${failed} need attention` : ''}` : 'All saved scans synced'}</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{!online ? 'Offline · reconnect to sync' : progress.syncing ? 'Uploading saved proofs…' : progress.lastSyncedAt ? `Last synced ${transactionTime(progress.lastSyncedAt, workspace?.timezone)}` : 'Ready to sync'}</Text>
          </View>
          {drafts.length > 0 ? <Button onPress={() => void retry()} disabled={!online || progress.syncing} loading={progress.syncing} contentStyle={{ minHeight: TOUCH_TARGET }}>Retry</Button> : null}
        </View>
      ) : null}
      {legacyCount > 0 ? <Button icon="restore" onPress={() => setShowRecovery(true)} contentStyle={{ minHeight: TOUCH_TARGET }}>Recover {legacyCount} saved {legacyCount === 1 ? 'scan' : 'scans'} from previous version</Button> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Portal>
        <Dialog visible={showRecovery} onDismiss={recovering ? undefined : () => setShowRecovery(false)}>
          <Dialog.Title>Recover saved scans</Dialog.Title>
          <Dialog.Content><Text>{legacyCount} scans in this workspace were saved before account ownership was stored. Recover only scans that belong to this workspace. They will be assigned to your account and synced; the proof files stay on this phone until the server saves them.</Text></Dialog.Content>
          <Dialog.Actions>
            <Button disabled={recovering} onPress={() => setShowRecovery(false)}>Cancel</Button>
            <Button disabled={recovering || !online} loading={recovering} onPress={() => void recover()}>Recover scans</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
