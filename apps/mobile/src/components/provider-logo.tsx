import type { Provider } from '@paytsek/contracts';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

const ARTWORK = {
  GCASH: require('../../assets/providers/gcash.jpg'),
  MAYA: require('../../assets/providers/maya.jpg'),
  GOTYME: require('../../assets/providers/gotyme.jpg'),
  MARIBANK: require('../../assets/providers/maribank.jpg'),
} as const;

export function providerFromLabel(label: string): Provider | null {
  const normalized = label.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('gcash')) return 'GCASH';
  if (normalized.includes('gotyme')) return 'GOTYME';
  if (normalized.includes('maya') || normalized.includes('paymaya')) return 'MAYA';
  if (normalized.includes('maribank') || normalized.includes('seabank')) return 'MARIBANK';
  return null;
}

type Props = {
  label?: string;
  provider?: Provider | null;
  size?: number;
};

/** Local provider artwork keeps payment rows recognizable while offline. */
export function ProviderLogo({ label = '', provider, size = 42 }: Props) {
  const theme = useTheme();
  const resolved = provider ?? providerFromLabel(label);
  const radius = Math.max(10, Math.round(size * 0.27));

  if (!resolved) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: radius, backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Icon source="wallet-outline" size={Math.round(size * 0.5)} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={ARTWORK[resolved]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
