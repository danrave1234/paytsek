import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import { RADIUS, SHADOW_COLOR, SPACING, TOUCH_TARGET, successColorFor } from '@/theme';
import { useReducedMotion } from './motion';

/**
 * Motion that explains a change: totals roll to their new value, the scan
 * line shows the camera is looking, and a saved proof draws its own check.
 * Every effect settles instantly when the system asks for reduced motion.
 */

const EASE_OUT = Easing.out(Easing.cubic);

/**
 * Text that rolls from its previous number to the next one. Only this text
 * re-renders per frame, never the screen around it. The first value is shown
 * as-is so opening a screen does not replay a count from zero.
 */
export function CountUpText({ value, format, duration = 620, animate = true, ...textProps }: {
  value: number;
  format: (value: number) => string;
  duration?: number;
  /** False while the value is still a placeholder (e.g. before data loads): snap instead of rolling. */
  animate?: boolean;
} & Omit<React.ComponentProps<typeof Text>, 'children'>) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const animated = useRef(new Animated.Value(value)).current;
  const wasAnimating = useRef(animate);

  useEffect(() => {
    const id = animated.addListener(({ value: next }) => setShown(Math.round(next)));
    return () => animated.removeListener(id);
  }, [animated]);

  useEffect(() => {
    // The first real value after a placeholder (animate false → true) snaps too:
    // it arrives in the same render that enables animation.
    const settled = wasAnimating.current;
    wasAnimating.current = animate;
    if (reduced || !animate || !settled) {
      animated.stopAnimation();
      animated.setValue(value);
      setShown(value);
      return;
    }
    const animation = Animated.timing(animated, { toValue: value, duration, easing: EASE_OUT, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setShown(value); });
    return () => animation.stop();
  }, [animate, animated, duration, reduced, value]);

  // Screen readers get the settled value, never an intermediate frame.
  return <Text {...textProps} accessibilityLabel={format(value)}>{format(shown)}</Text>;
}

/** Horizontal share bar that grows from the left edge. */
export function FillBar({ percent, color, trackColor, height = 7 }: { percent: number; color: string; trackColor: string; height?: number }) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(100, percent)) / 100;
  const scale = useRef(new Animated.Value(reduced ? target : 0)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(target); return; }
    const animation = Animated.timing(scale, { toValue: target, duration: 420, easing: EASE_OUT, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, scale, target]);
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: trackColor }}>
      <Animated.View style={{ height, width: '100%', borderRadius: height / 2, backgroundColor: color, transformOrigin: 'left', transform: [{ scaleX: scale }] }} />
    </View>
  );
}

/**
 * A slow line travelling down a capture frame: proof the camera is actively
 * looking. Rendered as a hairline with a soft glow, not a decorative gradient.
 */
export function ScanSweep({ active, color, inset = 0 }: { active: boolean; color: string; inset?: number }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduced || height <= 0) { progress.stopAnimation(); progress.setValue(0); return; }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, height, progress, reduced]);

  if (!active || reduced) return null;
  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: inset, bottom: inset, left: inset, right: inset }]} onLayout={onLayout}>
      <Animated.View
        style={{
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
          opacity: progress.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 0.85, 0.85, 0] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, height - 2)] }) }],
        }}
      />
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CHECK_LENGTH = 20;
const RING_LENGTH = 2 * Math.PI * 9.5;

/** A ring and check that draw themselves once: the save-confirmation mark. */
export function DrawnCheck({ size = 28, color, play }: { size?: number; color: string; play: number | null }) {
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const tick = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  // `play` is a token: each new non-null value draws the check again.
  useEffect(() => {
    if (play === null) return;
    if (reduced) { ring.setValue(1); tick.setValue(1); return; }
    ring.setValue(0);
    tick.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 320, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(tick, { toValue: 1, duration: 220, easing: EASE_OUT, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [play, reduced, ring, tick]);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AnimatedCircle
        cx={12} cy={12} r={9.5} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [RING_LENGTH, 0] })}
        rotation={-90} origin="12, 12"
      />
      <AnimatedPath
        d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={CHECK_LENGTH}
        strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0] })}
      />
    </Svg>
  );
}

export type Toast = { id: number; text: string };

/**
 * Save confirmation that rises from above the dock, draws its check, and
 * leaves on its own. Each toast has its own id so two identical saves in a
 * row still show (and announce) twice.
 */
export function SaveToast({ toast, onDismiss, bottom, duration = 3400 }: { toast: Toast | null; onDismiss: () => void; bottom: number; duration?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<string | null>(toast?.text ?? null);
  const message = toast?.text ?? null;
  const toastId = toast?.id ?? null;

  useEffect(() => {
    if (!message) return;
    setShown(message);
    AccessibilityInfo.announceForAccessibility(message);
    progress.setValue(reduced ? 1 : 0);
    const enter = reduced ? null : Animated.spring(progress, { toValue: 1, damping: 18, stiffness: 210, mass: 0.8, useNativeDriver: true });
    enter?.start();
    const timer = setTimeout(onDismiss, duration);
    return () => { clearTimeout(timer); enter?.stop(); };
    // Keyed on the toast id: a repeated identical message is still a new toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastId]);

  useEffect(() => {
    if (message || !shown) return;
    if (reduced) { setShown(null); return; }
    const exit = Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true });
    exit.start(({ finished }) => { if (finished) setShown(null); });
    return () => exit.stop();
  }, [message, progress, reduced, shown]);

  if (!shown) return null;
  const success = successColorFor(theme.dark);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: SPACING.lg,
        right: SPACING.lg,
        bottom,
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={`${shown}. Dismiss`}
        style={[styles.toast, { backgroundColor: theme.colors.inverseSurface }]}
      >
        <DrawnCheck play={toastId} color={theme.dark ? '#00664E' : success} />
        <Text variant="bodyMedium" style={{ color: theme.colors.inverseOnSurface, flex: 1, fontWeight: '600' }}>{shown}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    minHeight: TOUCH_TARGET + 8,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    shadowColor: SHADOW_COLOR,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
