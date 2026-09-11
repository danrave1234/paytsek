import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { PaperProvider, useTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { darkTheme, lightTheme } from '@/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeModeState = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => Promise<void>;
};

const key = 'paytsek.theme-mode.v1';
const ThemeModeContext = createContext<ThemeModeState | null>(null);

// Keep the native splash visible until the persisted theme is known. Without
// this, an explicitly dark app can mount one light frame before SecureStore
// resolves and native navigation will visibly flash white.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Persists an explicit visual preference while still offering a system mode. */
export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setStoredMode] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void SecureStore.getItemAsync(key)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') setStoredMode(stored);
      })
      .finally(() => setHydrated(true));
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setStoredMode(next);
    await SecureStore.setItemAsync(key, next);
  }, []);
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode, setMode]);

  useEffect(() => {
    if (!hydrated) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated, resolvedMode]);

  if (!hydrated) return null;

  return (
    <ThemeModeContext.Provider value={value}>
      <PaperProvider theme={resolvedMode === 'dark' ? darkTheme : lightTheme}>
        <ThemeSurface>{children}</ThemeSurface>
      </PaperProvider>
    </ThemeModeContext.Provider>
  );
}

/** Keeps every frame behind a route transition on the active theme surface. */
function ThemeSurface({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View collapsable={false} style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>
    </>
  );
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return value;
}
