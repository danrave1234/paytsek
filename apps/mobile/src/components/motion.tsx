import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function SelectionMotion({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(selected ? 1 : 0); return; }
    const animation = Animated.spring(progress, { toValue: selected ? 1 : 0, damping: 18, stiffness: 220, mass: 0.7, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [selected, reduced, progress]);
  return <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}>{children}</Animated.View>;
}

/**
 * Fade + slight rise when a list item first appears. Tracks which keys have
 * already animated so the initial page load does not cascade-animate every row.
 */
export function AppearMotion({ itemKey, children }: { itemKey: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const seen = useRef(new Set<string>()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (seen.has(itemKey)) return;
    seen.add(itemKey);
    if (reduced) return;
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [itemKey, reduced, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1 }}>
      {children}
    </Animated.View>
  );
}

/**
 * Soft scale pulse when a numeric value changes (e.g. hero total).
 * Fires only once per value change, not on every render.
 */
export function ValueChangeMotion({ value, children }: { value: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    prevValue.current = value;
    if (reduced) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [value, reduced, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * Scale-down press feedback for tappable elements.
 */
export function PressScale({ children, ...rest }: React.ComponentProps<typeof Animated.View> & { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animatePress = (pressed: boolean) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: pressed ? 0.97 : 1,
      damping: 18,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      {...rest}
      onTouchStart={() => animatePress(true)}
      onTouchEnd={() => animatePress(false)}
      onTouchCancel={() => animatePress(false)}
      style={[rest.style, { transform: [{ scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Fade in on mount. Skips animation if reduced motion is enabled.
 */
export function FadeIn({ children, duration = 180 }: { children: React.ReactNode; duration?: number }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [reduced, duration, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/**
 * Screen-level enter animation: slight fade + rise on first mount.
 */
export function ScreenEnter({ children, duration = 200 }: { children: React.ReactNode; duration?: number }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduced ? 0 : 12)).current;

  useEffect(() => {
    if (reduced) return;
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  }, [reduced, duration, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * Animate a bar height from 0 to the target once.
 * Uses non-native driver (layout animation) for height changes.
 * Renders a colored bar directly — the caller provides color and borderRadius.
 */
export function GrowBar({ height, color, borderRadius = 3 }: { height: number; color: string; borderRadius?: number }) {
  const reduced = useReducedMotion();
  const h = useRef(new Animated.Value(reduced ? height : 0)).current;

  useEffect(() => {
    if (reduced) { h.setValue(height); return; }
    h.setValue(0);
    Animated.timing(h, { toValue: height, duration: 220, useNativeDriver: false }).start();
  }, [reduced, height, h]);

  return <Animated.View style={{ height: h, width: '100%', minWidth: 2, borderRadius, backgroundColor: color }} />;
}
