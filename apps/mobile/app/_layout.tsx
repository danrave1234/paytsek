import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queries';
import { SessionProvider, useSession } from '@/lib/session';
import { syncAll, pruneSynced } from '@/lib/drafts';
import { reportHealth } from '@/lib/collector';
import { SPACING } from '@/theme';
import { Loading } from '@/components/ui';
import { ThemeModeProvider } from '@/lib/theme-mode';
import { useReducedMotion } from '@/components/motion';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, configured, session, workspace } = useSession();
  const theme = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const onboardingChecked = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const top = segments[0] as string | undefined;
    if (!configured) {
      if (top !== 'setup') router.replace('/setup');
      return;
    }
    // Payment phones pair with a device credential; no owner login is needed.
    if (top === 'pair' && (segments as readonly string[])[1] === 'collector') return;
    if (!session) {
      // OAuth resumes the app at the non-grouped /auth/callback route. Keep
      // that route mounted long enough to exchange the one-time code before
      // applying the usual unauthenticated redirect.
      const isOAuthCallback = top === 'auth' && (segments as readonly string[])[1] === 'callback';
      if (top !== '(auth)' && !isOAuthCallback) router.replace('/(auth)/sign-in');
      return;
    }
    if (!workspace) {
      if (__DEV__ && top === '(tabs)') return;
      if (top !== 'workspaces') router.replace('/workspaces');
      return;
    }
    const scope = `${session.user.id}.${workspace.id}`;
    let cancelled = false;
    if (onboardingChecked.current !== scope) {
      void hasSeenOnboarding(session.user.id, workspace.id).catch(() => false).then((seen) => {
        if (cancelled) return;
        onboardingChecked.current = scope;
        router.replace(seen ? '/(tabs)' : '/onboarding');
      });
    } else if (top === '(auth)' || top === 'workspaces' || top === undefined) router.replace('/(tabs)');
    return () => { cancelled = true; };
  }, [ready, configured, session, workspace, segments, router]);

  // On resume/reconnect: refetch server state (system of record) and retry local drafts.
  useEffect(() => {
    let syncing = false;
    // A paired payment phone has no reason to wait for its Settings page to
    // report that the Android listener is healthy. This also makes an upgrade
    // clear a stale health indicator as soon as the app is opened.
    if (Platform.OS === 'android') void reportHealth();
    const sub = AppState.addEventListener('change', (s) => {
      focusManager.setFocused(s === 'active');
      if (s === 'active' && workspace && !syncing) {
        if (Platform.OS === 'android') void reportHealth();
        syncing = true;
        void syncAll(workspace.id).then(async ({ synced }) => {
          if (synced > 0) {
            await Promise.all(['records', 'home', 'usage', 'inbox'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
          }
          await pruneSynced(workspace.id);
        }).catch(() => { /* Durable drafts will retry on the next resume. */ }).finally(() => { syncing = false; });
      }
    });
    return () => sub.remove();
  }, [workspace]);

  return (
    <>
      {children}
      {!ready ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1000,
            paddingHorizontal: SPACING.xl,
            paddingTop: SPACING.xxxl + SPACING.xxl,
            backgroundColor: theme.colors.background,
          }}
        >
          <Loading variant="dashboard" label="Opening PayTsek" />
        </View>
      ) : null}
    </>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Gate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          // Native chrome: flat surface-coloured bar, back-only on iOS,
          // centred title on Android — the platform defaults people know.
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          // Fade between themed surfaces. A native slide can briefly expose
          // Android's default white window while dark mode is active.
          animation: reducedMotion ? 'none' : 'fade',
          animationDuration: reducedMotion ? 0 : 140,
          presentation: 'card',
        }}
      >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="auth/callback" />
                  <Stack.Screen name="record/[id]" />
                  <Stack.Screen name="pair/index" options={{ headerShown: true, title: 'Connect payment phone' }} />
                  <Stack.Screen name="pair/collector" options={{ headerShown: true, title: 'Join as payment phone' }} />
                  <Stack.Screen name="settings/sources" options={{ headerShown: true, title: 'Payment sources' }} />
                  <Stack.Screen name="settings/devices" options={{ headerShown: true, title: 'Devices & health' }} />
                  <Stack.Screen name="settings/team" options={{ headerShown: true, title: 'Team' }} />
                  <Stack.Screen name="settings/billing" options={{ headerShown: true, title: 'Beta access' }} />
                  <Stack.Screen name="settings/privacy" options={{ headerShown: true, title: 'Privacy & data' }} />
                  <Stack.Screen name="settings/account" options={{ headerShown: true, title: 'Account' }} />
                  <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: 'Notifications' }} />
                  <Stack.Screen name="settings/inbox" options={{ headerShown: true, title: 'Incoming payments' }} />
                  <Stack.Screen name="settings/exports" options={{ headerShown: true, title: 'Export records' }} />
                  <Stack.Screen name="settings/samples" options={{ headerShown: true, title: 'Unknown formats' }} />
      </Stack>
    </Gate>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeModeProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <AppNavigator />
            </SessionProvider>
          </QueryClientProvider>
        </ThemeModeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
