import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
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
          <View style={styles.notes}>
            {(update?.notes ?? []).map((note, index) => (
              <View key={`${index}.${note}`} style={styles.note}>
                <Icon source="check" size={17} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ flex: 1 }}>{note}</Text>
              </View>
            ))}
          </View>
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
  notes: { marginTop: SPACING.lg, gap: SPACING.sm },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  progress: { marginTop: SPACING.lg, gap: SPACING.sm },
});
