import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { SPACING } from '@/theme';

/**
 * Handles the `paytsek://auth/callback?code=…` deep link after the system
 * browser completes Google OAuth. This must be an actual Expo Router route:
 * otherwise Android opens the app successfully, but Expo Router renders its
 * "unmatched route" screen before the sign-in page can observe the URL.
 */
export default function AuthCallback() {
  const theme = useTheme();
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;

    void supabase().auth.exchangeCodeForSession(url).then(({ error: exchangeError }) => {
      if (!active) return;
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      // SessionProvider observes SIGNED_IN and routes to workspace setup or
      // Scan. Replacing this route also keeps it out of the back stack.
      router.replace('/workspaces');
    });

    return () => { active = false; };
  }, [router, url]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.lg }}>
        {error ? (
          <>
            <Text variant="headlineSmall" style={{ textAlign: 'center' }}>Couldn’t finish sign-in</Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>{error}</Text>
            <Button mode="contained" onPress={() => router.replace('/(auth)/sign-in')}>Back to sign in</Button>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text variant="bodyLarge">Finishing sign-in…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
