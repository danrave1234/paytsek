import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { haptics } from '@/lib/haptics';
import { peso } from '@/lib/format';
import { barAt, peakIndex, type RhythmBar } from '@/lib/rhythm';
import { SPACING } from '@/theme';
import { GrowBar } from './motion';

type Props = {
  bars: RhythmBar[];
  /** Height of the tallest bar, in dp. */
  height: number;
  axis: string[];
  accessibilityLabel: string;
  /** Prefix for the default readout, e.g. "Busiest" or "Best day". */
  peakLabel: string;
  emptyLabel: string;
  gap?: number;
};

/** Movement (dp) below which a touch is a tap, above which it is a drag. */
const SLOP = 8;

function countText(count: number | null) {
  return count === null ? '' : ` · ${count} ${count === 1 ? 'record' : 'records'}`;
}

/**
 * Recorded amount over time. Tap a bar to read it (tap again to clear) or
 * drag sideways to scrub; vertical drags are left to the page scroll. The
 * readout otherwise shows the peak. Screen readers swipe up/down to adjust.
 */
export function RhythmChart({ bars, height, axis, accessibilityLabel, peakLabel, emptyLabel, gap = 5 }: Props) {
  const theme = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef<number | null>(null);
  const width = useRef(0);
  const count = useRef(bars.length);
  count.current = bars.length;
  // Bars can change under a selection (e.g. 30 days → 12 weeks); never index past the end.
  const selected = picked !== null && picked < bars.length ? picked : null;
  const max = Math.max(1, ...bars.map((bar) => bar.centavos));
  const peak = peakIndex(bars);

  const choose = (index: number | null) => {
    if (index === pickedRef.current) return;
    pickedRef.current = index;
    setPicked(index);
    haptics.select();
  };

  const responder = useMemo(() => {
    let dragging = false;
    const at = (x: number) => barAt(x, width.current, count.current);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => count.current > 0,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > SLOP && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => { dragging = false; },
      onPanResponderMove: (event, g) => {
        if (!dragging && Math.abs(g.dx) > SLOP && Math.abs(g.dx) > Math.abs(g.dy)) dragging = true;
        if (dragging) choose(at(event.nativeEvent.locationX));
      },
      onPanResponderRelease: (event, g) => {
        if (dragging || Math.abs(g.dx) > SLOP || Math.abs(g.dy) > SLOP) return;
        const index = at(event.nativeEvent.locationX);
        choose(index === pickedRef.current ? null : index);
      },
      // Once scrubbing sideways keep the gesture; otherwise yield to the page scroll.
      onPanResponderTerminationRequest: () => !dragging,
    });
    // `choose` only touches refs and a stable setter, so one responder is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const current = selected ?? peak ?? 0;
    const step = selected === null ? 0 : 1;
    if (event.nativeEvent.actionName === 'increment') choose(Math.min(bars.length - 1, current + step));
    if (event.nativeEvent.actionName === 'decrement') choose(Math.max(0, current - step));
  };

  const focus = selected ?? peak;
  const focusBar = focus === null ? null : bars[focus] ?? null;
  const title = !focusBar ? emptyLabel : selected !== null ? focusBar.label : `${peakLabel} · ${focusBar.label}`;
  const amount = focusBar ? `${peso(focusBar.centavos)}${countText(focusBar.count)}` : '';

  return (
    <View>
      <View style={styles.readout}>
        <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>{title}</Text>
        <Text variant="labelLarge" numberOfLines={1} style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{amount}</Text>
      </View>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: focusBar ? `${focusBar.label}: ${amount}` : emptyLabel }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={(event) => { width.current = event.nativeEvent.layout.width; }}
        style={[styles.bars, { height: height + 4, gap }]}
      >
        {bars.map((bar, index) => {
          const barHeight = bar.centavos > 0 ? Math.max(6, Math.round((bar.centavos / max) * height)) : 3;
          const active = index === focus;
          const dimmed = selected !== null && !active;
          return (
            <View key={index} pointerEvents="none" style={[styles.slot, { height, opacity: dimmed ? 0.38 : 1 }]}>
              <GrowBar height={barHeight} color={bar.centavos > 0 ? theme.colors.primary : theme.colors.outlineVariant} />
              {active && bar.centavos > 0 ? <View style={[styles.cap, { backgroundColor: theme.colors.primary }]} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants">
        {axis.map((label, index) => (
          <Text key={`${label}.${index}`} variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, justifyContent: 'flex-end' },
  cap: { position: 'absolute', bottom: -5, alignSelf: 'center', width: 4, height: 4, borderRadius: 2 },
  axis: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between' },
});
