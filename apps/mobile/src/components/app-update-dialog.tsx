import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, ProgressBar, Text, useTheme } from 'react-native-paper';
import { downloadAndInstallUpdate, type AppUpdate } from '@/lib/release-update';
import { SPACING } from '@/theme';

type Props = {
  update: AppUpdate | null | undefined;
  visible: boolean;
  onDismiss: () => void;
};

export function AppUpdateDialog({ update, visible, onDismiss }: Props) {
  const theme = useTheme();
  const [progress, setProgress] = useState<number | null>(null);

  const install = async () => {
    if (!update || progress !== null) return;
    setProgress(0);
    try {
      await downloadAndInstallUpdate(update, setProgress);
    } catch (error) {
      Alert.alert('Update could not start', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible && Boolean(update)} onDismiss={progress === null ? onDismiss : undefined}>
        <Dialog.Icon icon="cellphone-arrow-down" />
        <Dialog.Title>{update?.title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Version {update?.version}{update?.sizeBytes ? ` · ${(update.sizeBytes / 1_048_576).toFixed(1)} MB` : ''}
          </Text>
          <Text variant="bodySmall" style={[styles.updateSafety, { color: theme.colors.onSurfaceVariant }]}>
            Install over your current app. Don’t uninstall first—offline scans that have not synced yet live only on this phone.
          </Text>
          <ScrollView
            style={styles.notesScroll}
            contentContainerStyle={styles.notes}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            accessibilityLabel="Release notes"
          >
            {(update?.notes ?? []).map((note, index) => (
              <View key={`${index}.${note}`} style={styles.note}>
                <Icon source="check" size={17} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ flex: 1 }}>{note}</Text>
              </View>
            ))}
          </ScrollView>
          {progress !== null ? (
            <View style={styles.progress}>
              <ProgressBar progress={progress} color={theme.colors.primary} />
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Downloading {Math.round(progress * 100)}%</Text>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => update && void Linking.openURL(update.releaseUrl)} disabled={progress !== null}>Release page</Button>
          <Button mode="contained" icon="download" onPress={() => void install()} loading={progress !== null} disabled={progress !== null}>
            Update now
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  updateSafety: { marginTop: SPACING.sm },
  notesScroll: { maxHeight: 260, marginTop: SPACING.lg },
  notes: { gap: SPACING.sm, paddingBottom: SPACING.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  progress: { marginTop: SPACING.lg, gap: SPACING.sm },
});
