import type { EvidenceState, SyncStatus } from '@paytsek/contracts';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { stateLabel } from '@/lib/format';
import { useReducedMotion } from './motion';
import { RADIUS, SPACING, TAB_BAR_CLEARANCE, TOUCH_TARGET, stateColorsFor } from '@/theme';

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
export function Screen({
  children,
  scroll = true,
  tabbed = false,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  tabbed?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inner = <View style={[styles.screen, !scroll && tabbed && { paddingBottom: TAB_BAR_CLEARANCE }, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + (tabbed ? TAB_BAR_CLEARANCE : SPACING.xxl) }}
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
    <View style={{ gap: 4, marginBottom: SPACING.sm }}>
      <Text variant="headlineSmall" style={{ fontWeight: '700', letterSpacing: -0.45 }}>{title}</Text>
      {subtitle ? <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 21 }}>{subtitle}</Text> : null}
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
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
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
  const content = (
    <View style={styles.listRow}>
      {icon ? <Icon source={icon} size={22} color={destructive ? theme.colors.error : theme.colors.onSurfaceVariant} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyLarge" style={{ color: fg }}>{title}</Text>
        {subtitle ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} /> : null)}
    </View>
  );

  // A preference switch needs to remain independently interactive. Wrapping a
  // non-tappable row in a disabled ripple can swallow its touch events.
  if (!onPress) return <View accessibilityRole="text">{content}</View>;

  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button">
      {content}
    </TouchableRipple>
  );
}

type LoadingVariant = 'dashboard' | 'list' | 'detail' | 'form' | 'progress';

function SkeletonBlock({ width = '100%', height, radius = RADIUS.sm }: { width?: DimensionValue; height: number; radius?: number }) {
  const theme = useTheme();
  return <View style={{ width, height, borderRadius: radius, backgroundColor: theme.colors.surfaceVariant }} />;
}

/**
 * Content-shaped loading state. A single native opacity animation keeps the
 * page feeling alive without the visual noise and layout jump of a spinner.
 */
export function Loading({ label = 'Loading…', variant = 'list' }: { label?: string; variant?: LoadingVariant }) {
  const pulse = useRef(new Animated.Value(0.48)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (variant === 'progress' || reducedMotion) { pulse.setValue(0.65); return; }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.48, duration: 720, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, variant, reducedMotion]);

  if (variant === 'progress') {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite" accessibilityLabel={label}>
        {reducedMotion ? <Icon source="text-recognition" size={32} /> : <ActivityIndicator size="large" />}
        <Text variant="bodyMedium" style={{ marginTop: SPACING.md }}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.skeletonScene} accessible accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.skeletonScene, { opacity: pulse }]}>
        {variant === 'dashboard' ? (
          <>
            <SkeletonBlock width="56%" height={28} />
            <SkeletonBlock width="38%" height={16} />
            <SkeletonBlock height={216} radius={RADIUS.xl} />
            <SkeletonBlock width="34%" height={22} />
            <SkeletonBlock height={216} radius={RADIUS.lg} />
            <SkeletonBlock height={156} radius={RADIUS.lg} />
          </>
        ) : variant === 'detail' ? (
          <>
            <View style={styles.skeletonHeading}>
              <View style={{ flex: 1, gap: SPACING.sm }}>
                <SkeletonBlock width="48%" height={26} />
                <SkeletonBlock width="70%" height={15} />
              </View>
              <SkeletonBlock width={84} height={30} radius={RADIUS.full} />
            </View>
            <SkeletonBlock height={156} radius={RADIUS.lg} />
            <SkeletonBlock height={210} radius={RADIUS.lg} />
            <SkeletonBlock height={128} radius={RADIUS.lg} />
          </>
        ) : variant === 'form' ? (
          <>
            <SkeletonBlock width="52%" height={28} />
            <SkeletonBlock width="78%" height={16} />
            <SkeletonBlock height={56} radius={RADIUS.md} />
            <SkeletonBlock height={56} radius={RADIUS.md} />
            <SkeletonBlock height={52} radius={RADIUS.full} />
          </>
        ) : (
          <>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={styles.skeletonRow}>
                <SkeletonBlock width={44} height={44} radius={RADIUS.full} />
                <View style={{ flex: 1, gap: SPACING.sm }}>
                  <SkeletonBlock width={item % 2 ? '58%' : '72%'} height={17} />
                  <SkeletonBlock width={item % 2 ? '76%' : '52%'} height={13} />
                </View>
                <SkeletonBlock width={62} height={18} />
              </View>
            ))}
          </>
        )}
      </Animated.View>
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
  screen: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, minHeight: 240 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md },
  group: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg, minHeight: TOUCH_TARGET },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6 },
  skeletonScene: { width: '100%', gap: SPACING.md },
  skeletonActions: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  skeletonHeading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  skeletonRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
});
