import { CameraView } from 'expo-camera';
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';

export function CaptureSurface({ granted, canAskAgain, active, ready, busy, onPermission, onCapture, onImport, cameraRef, onReady, torch, onTorch }: {
  granted: boolean; canAskAgain: boolean; active: boolean; ready: boolean; busy: boolean;
  onPermission: () => void; onCapture: () => void; onImport: () => void;
  cameraRef: (camera: CameraView | null) => void; onReady: () => void;
  torch: boolean; onTorch: () => void;
}) {
  const theme = useTheme();
  const captureDisabled = busy || !granted || !ready || !active;

  return <View style={[styles.surface, { backgroundColor: granted ? '#101B2C' : theme.colors.surface }]}>
    {granted && active ? <CameraView ref={cameraRef} onCameraReady={onReady} enableTorch={torch} facing="back" style={StyleSheet.absoluteFill} /> : null}
    {granted ? (
      <>
        <View style={[styles.corner, styles.topLeft, { borderColor: theme.colors.primary }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: theme.colors.primary }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.colors.primary }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: theme.colors.primary }]} />
      </>
    ) : null}
    <View style={styles.topLine}>
      <View />
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
    </View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Import payment screenshot" disabled={busy} onPress={onImport} style={({ pressed }) => [styles.sideAction, { opacity: pressed || busy ? 0.5 : 1 }]}>
        <Icon source="image-multiple-outline" size={27} color="#FFFFFF" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Capture payment proof" accessibilityHint="Takes one photo when you tap" accessibilityState={{ disabled: captureDisabled, busy }} disabled={captureDisabled} onPress={onCapture} style={({ pressed }) => [styles.shutter, { opacity: captureDisabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
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
  flash: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1220CC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permission: { alignItems: 'center', gap: 14, padding: 24 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 12 },
  sideAction: { width: 72, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#FFFFFF99', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 34, height: 34, zIndex: 2 },
  topLeft: { top: 22, left: 22, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 22, right: 22, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 118, left: 22, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 118, right: 22, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
});
