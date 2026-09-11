import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { Screen } from '@/components/ui';
import { useIsOwner, useSession } from '@/lib/session';
import { markOnboardingSeen } from '@/lib/onboarding';
import { api } from '@/lib/api';
import { getInstallId, platform, osVersion } from '@/lib/device';
import { APP_VERSION } from '@/lib/env';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const owner = useIsOwner();
  const { session, workspace } = useSession();
  const [leaving, setLeaving] = useState(false);

  const continueTo = async (destination: '/(tabs)/scan' | '/pair') => {
    if (!session || !workspace || leaving) return;
    setLeaving(true);
    await markOnboardingSeen(session.user.id, workspace.id);
    router.replace(destination);

    // Registration improves device labeling but is not required to begin.
    // It runs after navigation so onboarding never waits on the backend.
    void api('/v1/devices/register-scanner', {
      method: 'POST',
      body: {
        deviceInstallId: await getInstallId(),
        platform,
        osVersion,
        appVersion: APP_VERSION,
        label: owner ? 'Owner phone' : 'Scanner phone',
      },
    }).catch(() => undefined);
  };

  return (
    <Screen scroll={false} style={styles.page}>
      <Image source={require('../assets/icon.png')} style={styles.mark} resizeMode="contain" accessibilityLabel="PayTsek" />
      <View style={styles.copy}>
        <Text variant="headlineSmall" style={styles.title}>Start with a scan</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{workspace?.name}</Text>
      </View>
      <View style={styles.actions}>
        <Button mode="contained" icon="line-scan" disabled={leaving} onPress={() => void continueTo('/(tabs)/scan')} contentStyle={{ minHeight: 58 }}>
          Scan payment
        </Button>
        {owner && Platform.OS === 'android' ? (
          <Button mode="text" icon="cellphone-message" disabled={leaving} onPress={() => void continueTo('/pair')} contentStyle={{ minHeight: TOUCH_TARGET }}>
            Set up payment phone
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
  mark: { width: 64, height: 64, borderRadius: RADIUS.lg, alignSelf: 'center' },
  copy: { alignItems: 'center', gap: SPACING.xs },
  title: { fontWeight: '700', letterSpacing: -0.8 },
  actions: { gap: SPACING.sm },
});
