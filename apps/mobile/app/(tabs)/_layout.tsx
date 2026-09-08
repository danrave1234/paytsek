import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Tab bar follows each platform's convention: filled icon when active,
 * outlined when not, and a bar that sits above the home indicator / gesture
 * bar rather than under it.
 */
const TABS = [
  { name: 'index', title: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'scan', title: 'Scan', icon: 'camera', iconOutline: 'camera-outline' },
  { name: 'records', title: 'Records', icon: 'receipt', iconOutline: 'receipt' },
  { name: 'review', title: 'Review', icon: 'clipboard-check', iconOutline: 'clipboard-check-outline' },
  { name: 'settings', title: 'Settings', icon: 'cog', iconOutline: 'cog-outline' },
] as const;

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Android gesture navigation reports a small inset; give it a floor so the
  // labels never sit flush against the bottom edge.
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Icon source={focused ? t.icon : t.iconOutline} color={String(color)} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
