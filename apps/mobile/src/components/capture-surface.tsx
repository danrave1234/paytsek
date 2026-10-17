import { CameraView } from 'expo-camera';
import React, { useEffect, useRef } from 'react';
import { Animated, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';
import { haptics } from '@/lib/haptics';
import type { AutoCaptureStatus } from '@/lib/use-receipt-auto-capture';
import { successColorFor } from '@/theme';
import { useReducedMotion } from './motion';
import { ScanSweep } from './motion-effects';

const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
// Direction each corner moves to "close in" on a found proof.
const INWARD = { topLeft: [1, 1], topRight: [-1, 1], bottomLeft: [1, -1], bottomRight: [-1, -1] } as const;

/**
 * The PayTsek aperture. When a readable proof is found the corners close in
 * and turn green, so "hold steady" is visible as well as written.
 */
function ApertureCorners({ locked, color, lockedColor }: { locked: boolean; color: string; lockedColor: string }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(locked ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(locked ? 1 : 0); return; }
    const animation = Animated.spring(progress, { toValue: locked ? 1 : 0, damping: 14, stiffness: 220, mass: 0.6, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [locked, progress, reduced]);
  return (
    <>
      {CORNERS.map((corner) => {
        const [x, y] = INWARD[corner];
        return (
          <Animated.View
            key={corner}
            style={[
              styles.corner,
              styles[corner],
              {
                borderColor: locked ? lockedColor : color,
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, x * 7] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, y * 7] }) },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
}

export function CaptureSurface({ granted, canAskAgain, active, ready, busy, onPermission, onCapture, onImport, cameraRef, onReady, torch, onTorch, autoCapture, autoStatus, onAutoCapture }: {
  granted: boolean; canAskAgain: boolean; active: boolean; ready: boolean; busy: boolean;
  onPermission: () => void; onCapture: () => void; onImport: () => void;
  cameraRef: (camera: CameraView | null) => void; onReady: () => void;
  torch: boolean; onTorch: () => void;
  autoCapture: boolean; autoStatus: AutoCaptureStatus; onAutoCapture: () => void;
}) {
  const theme = useTheme();
  const captureDisabled = busy || !granted || !ready || !active;

  return <View style={[styles.surface, { backgroundColor: granted ? '#101B2C' : theme.colors.surface }]}>
    {granted && active ? <CameraView ref={cameraRef} onCameraReady={onReady} enableTorch={torch} facing="back" style={StyleSheet.absoluteFill} /> : null}
    {granted ? (
      <>
        <View pointerEvents="none" style={styles.sweepFrame}>
          <ScanSweep active={active && ready && !busy && autoStatus !== 'CAPTURING'} color={autoStatus === 'HOLD_STILL' ? successColorFor(true) : '#8DB4FF'} inset={10} />
        </View>
        <ApertureCorners locked={autoStatus === 'HOLD_STILL' || autoStatus === 'CAPTURING'} color={theme.colors.primary} lockedColor={successColorFor(true)} />
      </>
    ) : null}
    <View style={styles.topLine}>
      <Pressable accessibilityRole="switch" accessibilityLabel="Automatic proof capture" accessibilityState={{ checked: autoCapture, disabled: !granted }} disabled={!granted} onPress={onAutoCapture} style={[styles.cameraAction, autoCapture && { backgroundColor: theme.colors.primary }]}>
        <Icon source={autoCapture ? 'camera-timer' : 'camera-off-outline'} size={22} color="#FFFFFF" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'} accessibilityState={{ selected: torch, disabled: !granted }} disabled={!granted} onPress={onTorch} style={[styles.flash, torch && { backgroundColor: theme.colors.primary }]}>
        <Icon source={torch ? 'flash' : 'flash-off'} size={22} color="#FFFFFF" />
      </Pressable>
    </View>
    <View style={styles.center} pointerEvents="none">
      {!granted ? (
        <View style={styles.permission} pointerEvents="auto">
          <Icon source="camera-outline" size={48} color={theme.colors.primary} />
          <Text variant="titleMedium">Camera access</Text>
          <Button mode="contained" onPress={canAskAgain ? onPermission : () => void Linking.openSettings()}>{canAskAgain ? 'Allow camera' : 'Open settings'}</Button>
        </View>
      ) : null}
      {granted ? (
        <View style={styles.autoStatus} accessibilityLiveRegion="polite">
          <Icon source={autoStatus === 'CAPTURING' ? 'check-circle-outline' : 'line-scan'} size={18} color="#FFFFFF" />
          <Text variant="labelMedium" style={styles.autoStatusText}>
            {autoStatus === 'OFF' ? 'Tap the shutter' : autoStatus === 'HOLD_STILL' ? 'Proof found — hold steady' : autoStatus === 'CAPTURING' ? 'Proof captured' : 'Show a completed payment proof'}
          </Text>
        </View>
      ) : null}
    </View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Import payment screenshot" disabled={busy} onPress={onImport} style={({ pressed }) => [styles.sideAction, { opacity: pressed || busy ? 0.5 : 1 }]}>
        <Icon source="image-multiple-outline" size={27} color="#FFFFFF" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Capture payment proof" accessibilityHint="Takes one photo when you tap" accessibilityState={{ disabled: captureDisabled, busy }} disabled={captureDisabled} onPressIn={() => haptics.press()} onPress={onCapture} style={({ pressed }) => [styles.shutter, { opacity: captureDisabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
        <View style={styles.shutterInner}><Icon source="line-scan" size={32} color="#101828" /></View>
      </Pressable>
      <View style={styles.sideAction} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  // This is the primary task, so it consumes the screen left above the dock
  // instead of being a small card inside a scrolling page.
  surface: { minHeight: 440, flex: 1, backgroundColor: '#101B2C', borderRadius: 28, overflow: 'hidden', padding: 18 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraAction: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1220CC' },
  flash: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1220CC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permission: { alignItems: 'center', gap: 14, padding: 24 },
  autoStatus: { minHeight: 44, maxWidth: '90%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0B1220D9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  autoStatusText: { color: '#FFFFFF', textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 12 },
  sideAction: { width: 72, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#FFFFFF99', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 34, height: 34, zIndex: 2 },
  sweepFrame: { position: 'absolute', top: 22, left: 22, right: 22, bottom: 118 },
  topLeft: { top: 22, left: 22, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 22, right: 22, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 118, left: 22, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 118, right: 22, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
});
