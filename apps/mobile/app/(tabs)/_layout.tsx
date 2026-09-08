import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

export default function TabsLayout() {
  const theme = useTheme();
  const icon = (name: string) => ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => <Icon source={name} color={typeof color === 'string' ? color : String(color)} size={size} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('camera-outline') }} />
      <Tabs.Screen name="records" options={{ title: 'Records', tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="review" options={{ title: 'Review', tabBarIcon: icon('clipboard-check-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('cog-outline') }} />
    </Tabs>
  );
}
