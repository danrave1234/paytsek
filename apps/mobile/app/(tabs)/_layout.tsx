import { Tabs } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/components/motion';

type ScanButtonProps = {
  children?: React.ReactNode;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Brand-shaped center action: a receipt aperture, not a generic FAB. */
function ScanTabButton({ children, onPress, onLongPress, accessibilityLabel, accessibilityState, testID, style }: ScanButtonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 330,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };
  return (
    <View style={[style, styles.scanSlot]}>
      <Animated.View
        style={[
          styles.scanOuter,
          {
            backgroundColor: theme.colors.background,
            transform: [{ translateY: -18 }, { scale }],
          },
        ]}
      >
        <Pressable
          onPress={onPress ?? undefined}
          onLongPress={onLongPress ?? undefined}
          onPressIn={() => animate(0.94)}
          onPressOut={() => animate(1)}
          accessibilityRole="tab"
          accessibilityLabel={accessibilityLabel ?? 'Scan payment proof'}
          accessibilityState={accessibilityState}
          testID={testID}
          style={({ pressed }) => [
            styles.scanInner,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed && reducedMotion ? 0.88 : 1,
            },
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 6);

  return (
    <Tabs
      initialRouteName="scan"
      backBehavior="history"
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 78 + bottomInset,
          paddingTop: 9,
          paddingBottom: bottomInset,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.dark ? '#161B26FA' : '#FFFEFCFA',
          shadowColor: '#101828',
          shadowOpacity: theme.dark ? 0.34 : 0.11,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -5 },
          elevation: 18,
        },
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today tab',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.regularIcon}>
              <Icon source={focused ? 'home-variant' : 'home-variant-outline'} size={25} color={String(color)} />
              {focused ? <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          tabBarAccessibilityLabel: 'Records tab',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.regularIcon}>
              <Icon source={focused ? 'receipt-text' : 'receipt-text-outline'} size={23} color={String(color)} />
              {focused ? <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarAccessibilityLabel: 'Scan payment proof tab',
          tabBarButton: (props) => <ScanTabButton {...props} />,
          tabBarIcon: () => <Icon source="qrcode-scan" size={29} color={theme.colors.onPrimary} />,
          tabBarLabel: () => <Text variant="labelMedium" style={{ color: theme.colors.onPrimary, fontWeight: '800' }}>Scan</Text>,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarAccessibilityLabel: 'Analytics tab',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.regularIcon}>
              <Icon source={focused ? 'chart-box' : 'chart-box-outline'} size={23} color={String(color)} />
              {focused ? <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.regularIcon}>
              <Icon source={focused ? 'cog' : 'cog-outline'} size={23} color={String(color)} />
              {focused ? <View style={[styles.activeDot, { backgroundColor: theme.colors.primary }]} /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="review" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: { minHeight: 64 },
  label: { marginTop: 2, fontSize: 10.5, fontWeight: '700' },
  scanSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  regularIcon: { height: 30, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: -6, width: 5, height: 5, borderRadius: 3 },
  scanOuter: { width: 76, height: 76, padding: 6, borderRadius: 23 },
  scanInner: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    shadowColor: '#155EEF',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
