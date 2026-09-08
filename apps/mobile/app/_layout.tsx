import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queries';
import { SessionProvider, useSession } from '@/lib/session';
import { syncAll } from '@/lib/drafts';
import { darkTheme, lightTheme } from '@/theme';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, configured, session, workspace } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const top = segments[0] as string | undefined;
    if (!configured) {
      if (top !== 'setup') router.replace('/setup');
      return;
    }
    if (!session) {
      if (top !== '(auth)') router.replace('/(auth)/sign-in');
      return;
    }
    if (!workspace) {
      if (top !== 'workspaces') router.replace('/workspaces');
      return;
    }
    if (top === '(auth)' || top === 'workspaces' || top === undefined) router.replace('/(tabs)');
  }, [ready, configured, session, workspace, segments, router]);

  // On resume/reconnect: refetch server state (system of record) and retry local drafts.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      focusManager.setFocused(s === 'active');
      if (s === 'active' && workspace) void syncAll(workspace.id).then(() => queryClient.invalidateQueries());
    });
    return () => sub.remove();
  }, [workspace]);

  return <>{children}</>;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <Gate>
                <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: theme.colors.background },
                    // Native chrome: flat surface-coloured bar, back-only on
                    // iOS, centred title on Android — the platform defaults
                    // people already know.
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.onSurface,
                    headerTitleStyle: { fontWeight: '600', fontSize: 17 },
                    headerShadowVisible: false,
                    headerBackButtonDisplayMode: 'minimal',
                    animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="record/[id]" options={{ headerShown: true, title: 'Record' }} />
                  <Stack.Screen name="pair/index" options={{ headerShown: true, title: 'Connect payment phone' }} />
                  <Stack.Screen name="pair/collector" options={{ headerShown: true, title: 'Join as payment phone' }} />
                  <Stack.Screen name="settings/sources" options={{ headerShown: true, title: 'Receiving accounts' }} />
                  <Stack.Screen name="settings/devices" options={{ headerShown: true, title: 'Devices & health' }} />
                  <Stack.Screen name="settings/team" options={{ headerShown: true, title: 'Team' }} />
                  <Stack.Screen name="settings/billing" options={{ headerShown: true, title: 'Plan & usage' }} />
                  <Stack.Screen name="settings/privacy" options={{ headerShown: true, title: 'Privacy & data' }} />
                  <Stack.Screen name="settings/inbox" options={{ headerShown: true, title: 'Incoming payments' }} />
                  <Stack.Screen name="settings/exports" options={{ headerShown: true, title: 'Export records' }} />
                  <Stack.Screen name="settings/samples" options={{ headerShown: true, title: 'Unknown formats' }} />
                </Stack>
              </Gate>
            </SessionProvider>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
