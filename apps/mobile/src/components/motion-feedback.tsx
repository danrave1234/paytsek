import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, UIManager, type ViewStyle } from 'react-native';
import { reducedMotionNow, useReducedMotion } from './motion';

/**
 * Small feedback motions: content that expands in place, an input that
 * shakes when it cannot be accepted, staggered entrances and icon swaps.
 * All of them use React Native's built-in animation APIs.
 */

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  // No-op on the New Architecture; required on the legacy renderer.
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_EASE = LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

/**
 * Call immediately before a state change that grows, shrinks or removes
 * content (expanding a proof, dismissing a banner) so the layout eases into
 * place instead of jumping.
 */
export function animateNextLayout() {
  if (reducedMotionNow()) return;
  LayoutAnimation.configureNext(LAYOUT_EASE);
}

/** A short horizontal shake for an input that could not be accepted. */
export function useShake(): { style: Animated.WithAnimatedObject<ViewStyle>; shake: () => void } {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    if (reduced) return;
    offset.setValue(0);
    Animated.sequence(
      [8, -7, 5, -3, 0].map((toValue) => Animated.timing(offset, { toValue, duration: 55, easing: Easing.linear, useNativeDriver: true })),
    ).start();
  }, [offset, reduced]);
  return { style: { transform: [{ translateX: offset }] }, shake };
}

/** Fade and rise on mount after `delay`, for composing a staggered first view. */
export function RiseIn({ delay = 0, distance = 14, children, style }: { delay?: number; distance?: number; children: React.ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotionNow() ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Turns an icon in when its meaning changes (e.g. light → dark mode). */
export function SwapMotion({ swapKey, children }: { swapKey: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(swapKey);
  useEffect(() => {
    if (previous.current === swapKey) return;
    previous.current = swapKey;
    if (reduced) return;
    progress.setValue(0);
    const animation = Animated.spring(progress, { toValue: 1, damping: 12, stiffness: 200, mass: 0.6, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, swapKey]);
  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Gentle repeating pulse while background work is running (e.g. uploading). */
export function WorkingPulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduced) { opacity.stopAnimation(); opacity.setValue(1); return; }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, opacity, reduced]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
