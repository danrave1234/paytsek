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
  const ink = granted ? '#FFFFFF' : theme.colors.onSurface;
  const muted = granted ? '#D1DCEC' : theme.colors.onSurfaceVariant;
  const captureDisabled = busy || !granted || !ready || !active;
  return <View style={[styles.surface, { backgroundColor: granted ? '#101B2C' : theme.colors.surface }]}>
    {granted && active ? <CameraView ref={cameraRef} onCameraReady={onReady} enableTorch={torch} facing="back" style={StyleSheet.absoluteFill} /> : null}
    <View style={styles.topLine}>
      <Text variant="labelLarge" style={{ color: muted }}>PAYMENT PROOF</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'} accessibilityState={{ selected: torch, disabled: !granted }} disabled={!granted} onPress={onTorch} style={[styles.flash, torch && { backgroundColor: theme.colors.primary }]}>
        <Icon source={torch ? 'flash' : 'flash-off'} size={22} color={ink} />
      </Pressable>
    </View>
    <View style={styles.center}>
      {!granted ? <Icon source="line-scan" size={64} color={theme.colors.primary} /> : null}
      <Text variant="headlineSmall" style={[styles.title, { color: ink, backgroundColor: granted ? '#101B2C99' : 'transparent' }]}>{granted ? 'Keep the receipt in view' : 'Ready when you are'}</Text>
      <Text variant="bodyMedium" style={[styles.hint, { color: muted, backgroundColor: granted ? '#101B2C99' : 'transparent' }]}>{granted ? 'Fit the full receipt. Keep the amount and reference clear.' : 'Scan a receipt or import a payment screenshot. We’ll fill in the details for you.'}</Text>
      {!granted ? <Button mode="contained" onPress={canAskAgain ? onPermission : () => void Linking.openSettings()} style={{ marginTop: 20 }}>{canAskAgain ? 'Enable camera' : 'Open camera settings'}</Button> : null}
    </View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Import payment screenshot" disabled={busy} onPress={onImport} style={({ pressed }) => [styles.sideAction, { opacity: pressed || busy ? 0.5 : 1 }]}>
        <Icon source="image-multiple-outline" size={26} color={granted ? ink : theme.colors.primary} /><Text variant="labelMedium" style={{ color: ink }}>Import</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Capture receipt" accessibilityState={{ disabled: captureDisabled, busy }} disabled={captureDisabled} onPress={onCapture} style={({ pressed }) => [styles.shutter, { opacity: captureDisabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
        <View style={styles.shutterInner}><Icon source="line-scan" size={32} color="#101828" /></View>
      </Pressable>
      <View style={styles.sideAction}><Icon source="shield-check-outline" size={24} color={muted} /><Text variant="labelSmall" style={{ color: muted }}>On-device</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  // This is the primary task, so it consumes the screen left above the dock
  // instead of being a small card inside a scrolling page.
  surface: { minHeight: 440, flex: 1, backgroundColor: '#101B2C', borderRadius: 28, overflow: 'hidden', padding: 20 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  white: { color: '#FFFFFF' },
  flash: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF18' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  title: { color: '#FFFFFF', textAlign: 'center', marginTop: 16, fontWeight: '600', backgroundColor: '#101B2C99' },
  hint: { color: '#D1DCEC', textAlign: 'center', maxWidth: 270, marginTop: 8, backgroundColor: '#101B2C99' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 12 },
  sideAction: { width: 72, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 8 },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#FFFFFF99', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
