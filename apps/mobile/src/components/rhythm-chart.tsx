import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent } from 'react-native';
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

function countText(count: number | null) {
  return count === null ? '' : ` · ${count} ${count === 1 ? 'record' : 'records'}`;
}

/**
 * Recorded amount over time. Tap or drag across the bars to read one; the
 * readout otherwise shows the peak. Screen readers adjust it with swipe
 * up/down instead of hunting for thin bars.
 */
export function RhythmChart({ bars, height, axis, accessibilityLabel, peakLabel, emptyLabel, gap = 5 }: Props) {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const width = useRef(0);
  const max = Math.max(1, ...bars.map((bar) => bar.centavos));
  const peak = peakIndex(bars);

  // A different period or day replaces the bars; drop a stale selection.
  useEffect(() => { setSelected(null); }, [bars.length, bars[0]?.label]);

  const choose = (index: number | null) => {
    if (index === null || index === selected) return;
    setSelected(index);
    haptics.select();
  };
  const fromTouch = (event: GestureResponderEvent) => choose(barAt(event.nativeEvent.locationX, width.current, bars.length));
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const current = selected ?? peak ?? 0;
    if (event.nativeEvent.actionName === 'increment') choose(Math.min(bars.length - 1, current + (selected === null ? 0 : 1)));
    if (event.nativeEvent.actionName === 'decrement') choose(Math.max(0, current - (selected === null ? 0 : 1)));
  };

  const focus = selected ?? peak;
  const focusBar = focus === null ? null : bars[focus];
  const title = selected !== null ? focusBar!.label : focusBar ? `${peakLabel} · ${focusBar.label}` : emptyLabel;
  const amount = focusBar ? `${peso(focusBar.centavos)}${countText(focusBar.count)}` : '';

  return (
    <View>
      <View style={styles.readout}>
        <Text variant="labelMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>{title}</Text>
        <Text variant="labelLarge" numberOfLines={1} style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{amount}</Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: focusBar ? `${focusBar.label}: ${amount}` : emptyLabel }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={(event) => { width.current = event.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => bars.length > 0}
        onResponderGrant={fromTouch}
        onResponderMove={fromTouch}
        // Let the page scroll take over when the drag is clearly vertical.
        onResponderTerminationRequest={() => true}
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
