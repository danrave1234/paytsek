import type { EvidenceState, SyncStatus } from '@payrecord/contracts';
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { stateLabel } from '@/lib/format';
import { TOUCH_TARGET, stateColors } from '@/theme';

/** Evidence-state badge: colour + icon + text (never colour alone). */
export function StateChip({ state, compact = false }: { state: EvidenceState; compact?: boolean }) {
  const c = stateColors[state];
  return (
    <View accessibilityRole="text" accessibilityLabel={`Status: ${stateLabel(state)}`} style={[styles.chip, { backgroundColor: c.bg }, compact && styles.chipCompact]}>
      <Icon source={c.icon} size={compact ? 14 : 16} color={c.fg} />
      <Text variant={compact ? 'labelSmall' : 'labelMedium'} style={{ color: c.fg, fontWeight: '600' }}>
        {stateLabel(state)}
      </Text>
    </View>
  );
}

export function SyncChip({ status, quotaBlocked }: { status: SyncStatus; quotaBlocked?: boolean }) {
  const theme = useTheme();
  const label = quotaBlocked
    ? 'Pending — quota reached'
    : status === 'SYNCED' ? 'Synced' : status === 'UPLOADING' ? 'Uploading…' : status === 'PARTIAL_UPLOAD' ? 'Partially uploaded' : status === 'FAILED' ? 'Sync failed' : 'Saved on this phone';
  const icon = status === 'SYNCED' ? 'cloud-check-outline' : status === 'FAILED' ? 'cloud-alert' : 'cloud-upload-outline';
  return (
    <View style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Icon source={icon} size={14} color={theme.colors.onSurfaceVariant} />
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
    </View>
  );
}

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const theme = useTheme();
  const inner = <View style={[styles.screen, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator />
      <Text variant="bodyMedium" style={{ marginTop: 12 }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Icon source={icon} size={48} color={theme.colors.onSurfaceVariant} />
      <Text variant="titleMedium" style={{ marginTop: 12, textAlign: 'center' }}>{title}</Text>
      {body ? <Text variant="bodyMedium" style={{ marginTop: 6, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>{body}</Text> : null}
      {action ? <Button mode="contained-tonal" style={{ marginTop: 16, minHeight: TOUCH_TARGET }} onPress={action.onPress}>{action.label}</Button> : null}
    </View>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return <EmptyState icon="alert-circle-outline" title="Could not load" body={msg} action={retry ? { label: 'Try again', onPress: retry } : undefined} />;
}

/** Inline notice for offline / stale / warning banners. */
export function Notice({ kind, children }: { kind: 'info' | 'warning' | 'error'; children: React.ReactNode }) {
  const theme = useTheme();
  const bg = kind === 'error' ? theme.colors.errorContainer : kind === 'warning' ? theme.colors.tertiaryContainer : theme.colors.secondaryContainer;
  const fg = kind === 'error' ? theme.colors.onErrorContainer : kind === 'warning' ? theme.colors.onTertiaryContainer : theme.colors.onSecondaryContainer;
  const icon = kind === 'error' ? 'alert-octagon-outline' : kind === 'warning' ? 'alert-outline' : 'information-outline';
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Icon source={icon} size={18} color={fg} />
      <Text variant="bodySmall" style={{ color: fg, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text variant="bodyMedium" style={{ fontWeight: '600', textAlign: 'right', flexShrink: 1 }}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  chipCompact: { paddingHorizontal: 8, paddingVertical: 3 },
  screen: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 240 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
});
