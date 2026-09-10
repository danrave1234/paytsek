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
