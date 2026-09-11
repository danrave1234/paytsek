import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/components/motion';

/**
 * A compact floating dock keeps the primary destinations reachable while
 * letting the screen remain visually dominant. Every icon stays inside the
 * dock; icon and label color communicate selection without extra markers.
 */
const TABS = [
  { name: 'index', title: 'Home', icon: 'home-variant', iconOutline: 'home-variant-outline' },
  { name: 'scan', title: 'Scan', icon: 'line-scan', iconOutline: 'line-scan', primary: true },
  { name: 'settings', title: 'Settings', icon: 'cog', iconOutline: 'cog-outline' },
] as const;

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);

  return (
    <Tabs
      initialRouteName="scan"
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: bottomInset,
          height: 76,
          paddingBottom: 10,
          paddingTop: 10,
          borderRadius: 30,
          borderWidth: StyleSheet.hairlineWidth,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.dark ? '#161B26F2' : '#FFFFFFF2',
          elevation: 16,
          shadowColor: '#101828',
          shadowOpacity: theme.dark ? 0.28 : 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            ...('primary' in t ? {
              tabBarLabelStyle: [styles.tabLabel, styles.scanLabel, { color: theme.colors.primary }],
            } : {}),
            tabBarIcon: ({ focused, color, size }) => (
              <View style={[styles.iconContainer, 'primary' in t && styles.scanAction, 'primary' in t && { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
                <Icon
                  source={focused ? t.icon : t.iconOutline}
                  color={'primary' in t ? theme.colors.onPrimary : String(color)}
                  size={'primary' in t ? 32 : size}
                />
              </View>
            ),
            tabBarAccessibilityLabel: `${t.title} tab`,
          }}
        />
      ))}
      <Tabs.Screen name="records" options={{ href: null }} />
      <Tabs.Screen name="review" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { borderRadius: 24 },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  scanLabel: { fontWeight: '700', fontSize: 12 },
  iconContainer: { width: 48, height: 32, alignItems: 'center', justifyContent: 'center' },
  scanAction: { width: 60, height: 60, borderRadius: 30, borderWidth: 5, transform: [{ translateY: -16 }], shadowColor: '#101828', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});
