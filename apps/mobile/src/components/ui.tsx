import type { EvidenceState, SyncStatus } from '@payrecord/contracts';
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { stateLabel } from '@/lib/format';
import { RADIUS, SPACING, TOUCH_TARGET, stateColorsFor } from '@/theme';

/** True when Paper is running the dark scheme; drives the state palette. */
function useIsDark() {
  return useTheme().dark;
}

/** Evidence-state badge: colour + icon + text (never colour alone). */
export function StateChip({ state, compact = false }: { state: EvidenceState; compact?: boolean }) {
  const c = stateColorsFor(useIsDark())[state];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${stateLabel(state)}`}
      style={[styles.chip, { backgroundColor: c.bg }, compact && styles.chipCompact]}
    >
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

/**
 * Standard screen container. Keeps content clear of the notch and of the
 * home indicator / gesture bar, which a plain padding value cannot do.
 */
export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inner = <View style={[styles.screen, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/** Screen title block for screens that render their own header. */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2, marginBottom: SPACING.xs }}>
      <Text variant="headlineSmall" style={{ fontWeight: '600', letterSpacing: -0.3 }}>{title}</Text>
      {subtitle ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text> : null}
    </View>
  );
}

/** Grouped-list heading, the platform-standard way to label a settings block. */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      variant="labelMedium"
      style={{ color: theme.colors.primary, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.xs }}
    >
      {children}
    </Text>
  );
}

/**
 * Grouped list: rounded card holding related rows, separated by hairlines.
 * The convention on both iOS Settings and modern Material list screens.
 */
export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View>
      {title ? <SectionHeader>{title}</SectionHeader> : null}
      <View style={[styles.group, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.outlineVariant, marginLeft: SPACING.xl + SPACING.md }} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Tappable settings row with a chevron — the standard mobile list affordance. */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
  destructive = false,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const fg = destructive ? theme.colors.error : theme.colors.onSurface;
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <View style={styles.listRow}>
        {icon ? <Icon source={icon} size={22} color={destructive ? theme.colors.error : theme.colors.onSurfaceVariant} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyLarge" style={{ color: fg }}>{title}</Text>
          {subtitle ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text> : null}
        </View>
        {right ?? (onPress ? <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} /> : null)}
      </View>
    </TouchableRipple>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator />
      <Text variant="bodyMedium" style={{ marginTop: SPACING.md }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon source={icon} size={32} color={theme.colors.onSurfaceVariant} />
      </View>
      <Text variant="titleMedium" style={{ marginTop: SPACING.lg, textAlign: 'center', fontWeight: '600' }}>{title}</Text>
      {body ? (
        <Text variant="bodyMedium" style={{ marginTop: SPACING.xs + 2, textAlign: 'center', color: theme.colors.onSurfaceVariant, maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button mode="contained-tonal" style={{ marginTop: SPACING.lg, minHeight: TOUCH_TARGET }} onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
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
      <Text variant="bodySmall" style={{ color: fg, flex: 1, lineHeight: 18 }}>{children}</Text>
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
  screen: { padding: SPACING.lg, gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, minHeight: 240 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md },
  group: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, minHeight: TOUCH_TARGET },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6 },
});
