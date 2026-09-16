import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Screen, ScreenTitle, Group, Notice } from '@/components/ui';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { SPACING, TOUCH_TARGET, successColorFor } from '@/theme';

/** Check row: icon + label + subtitle + tappable fix action or check mark. */
function CheckRow({
  icon,
  label,
  subtitle,
  status,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  status: 'ok' | 'warn' | 'missing' | 'n/a';
  onPress?: () => void;
}) {
  const theme = useTheme();
  const fg =
    status === 'ok' ? successColorFor(theme.dark) :
    status === 'warn' ? theme.colors.onTertiaryContainer :
    status === 'missing' ? theme.colors.error :
    theme.colors.onSurfaceVariant;

  const statusIcon =
    status === 'ok' ? 'check-circle' :
    status === 'warn' ? 'alert-circle' :
    status === 'missing' ? 'close-circle' :
    'minus-circle';

  const statusLabel =
    status === 'ok' ? 'Granted' :
    status === 'warn' ? 'Needs attention' :
    status === 'missing' ? 'Missing' :
    'Not applicable';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: TOUCH_TARGET }}>
      <Icon source={icon} size={22} color={theme.colors.onSurfaceVariant} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>{label}</Text>
        {subtitle ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text>
        ) : null}
        <Text variant="labelSmall" style={{ color: fg, fontWeight: '600' }}>
          {statusLabel}
        </Text>
      </View>
      {onPress ? (
        <TouchableRipple onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${statusLabel}. Tap to fix.`}>
          <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
        </TouchableRipple>
      ) : (
        <Icon source={statusIcon} size={22} color={fg} />
      )}
    </View>
  );
}

export default function PermissionsChecklist() {
  const router = useRouter();
  const theme = useTheme();
  const [cameraPerm, cameraRequest] = useCameraPermissions();
  const [photos, setPhotos] = useState<'ok' | 'missing' | 'n/a'>('n/a');
  const [notifPerm, setNotifPerm] = useState<'ok' | 'missing' | 'n/a'>('n/a');
  const [collector, setCollector] = useState<CollectorStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const cameraStatus = cameraPerm?.status === 'granted' ? 'ok' : 'missing';

  const refresh = async () => {
    setLoading(true);
    try {
      // Camera — required for scanning proofs (useCameraPermissions gives us the current state)
      // No need to call request here, just read the status

      // Photos — optional (import from gallery)
      const { status: photoStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      setPhotos(photoStatus === 'granted' ? 'ok' : 'missing');

      // POST_NOTIFICATIONS — Android 13+ only
      if (Platform.OS === 'android' && (Platform.Version ?? 0) >= 33) {
        const granted = await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS');
        setNotifPerm(granted ? 'ok' : 'missing');
      } else {
        setNotifPerm('n/a');
      }

      // Collector status — Android only
      if (Platform.OS === 'android') {
        const status = await PaymentCollector.getStatus();
        setCollector(status);
      }
    } catch {
      /* If permission checks fail, leave defaults (missing/n/a) */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Refresh on app resume so revoked permissions are picked up.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, []);

  const requestCamera = async () => {
    try {
      await cameraRequest();
    } catch {
      void Linking.openSettings();
    }
  };

  const requestPhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPhotos(status === 'granted' ? 'ok' : 'missing');
    } catch {
      void Linking.openSettings();
    }
  };

  const requestNotifPerm = async () => {
    try {
      const granted = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS', {
        title: 'Notification permission',
        message: 'PayTsek needs this to post the listener test notification.',
        buttonPositive: 'Grant',
      });
      setNotifPerm(granted === 'granted' ? 'ok' : 'missing');
    } catch {
      void Linking.openSettings();
    }
  };

  const openNotifAccessSettings = () => {
    PaymentCollector.openNotificationAccessSettings();
  };

  const openWalletSources = () => {
    router.push('/settings/sources');
  };

  const isAndroid = Platform.OS === 'android';
  const isSupported = collector?.supported ?? false;
  const isConfigured = collector?.configured ?? false;
  const accessGranted = collector?.notificationAccessGranted ?? false;
  const isConnected = collector?.listenerConnected ?? false;
  const enabledProviders = collector?.enabledProviders ?? [];

  return (
    <Screen>
      <ScreenTitle
        title="Permissions"
        subtitle="Check that PayTsek has the access it needs to scan proofs and listen for wallet payments."
      />

      {loading ? (
        <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Checking permissions…</Text>
        </View>
      ) : (
        <>
          <Group title="Proof recording">
            <CheckRow
              icon="camera-outline"
              label="Camera"
              subtitle="Required to scan payment proofs"
              status={cameraStatus}
              onPress={cameraStatus === 'missing' ? requestCamera : undefined}
            />
            <CheckRow
              icon="image-outline"
              label="Photo library"
              subtitle="Optional. Import proofs from gallery"
              status={photos}
              onPress={photos === 'missing' ? requestPhotos : undefined}
            />
          </Group>

          {isAndroid ? (
            <>
              <Group title="Wallet notification listening">
                <CheckRow
                  icon="bell-ring-outline"
                  label="Notification access"
                  subtitle={accessGranted
                    ? 'PayTsek can read wallet notifications'
                    : 'Required for automatic payment matching'}
                  status={accessGranted ? 'ok' : 'missing'}
                  onPress={accessGranted ? undefined : openNotifAccessSettings}
                />

                <CheckRow
                  icon="cellbase"
                  label="Collector configured"
                  subtitle={isConfigured
                    ? 'Listening is set up on this phone'
                    : 'Set up wallet sources first'}
                  status={isConfigured ? 'ok' : 'missing'}
                  onPress={isConfigured ? undefined : openWalletSources}
                />

                {isConfigured && (
                  <CheckRow
                    icon="connection"
                    label="Listener connected"
                    subtitle={isConnected
                      ? 'Actively watching for notifications'
                      : 'Connected after granting notification access'}
                    status={isConnected ? 'ok' : 'warn'}
                    onPress={isConnected ? undefined : openNotifAccessSettings}
                  />
                )}

                {isConfigured && enabledProviders.length > 0 && (
                  <CheckRow
                    icon="wallet-outline"
                    label={`Wallets enabled (${enabledProviders.length})`}
                    subtitle={enabledProviders.join(', ')}
                    status="ok"
                  />
                )}

                {isConfigured && enabledProviders.length === 0 && (
                  <CheckRow
                    icon="wallet-off-outline"
                    label="No wallets enabled"
                    subtitle="Enable at least one wallet to listen for payments"
                    status="warn"
                    onPress={openWalletSources}
                  />
                )}

                {!isSupported && (
                  <Notice kind="warning">
                    Notification listening requires the signed PayTsek APK. It is not available in Expo Go or development builds.
                  </Notice>
                )}
              </Group>

              <Group title="Test notifications">
                <CheckRow
                  icon="test-tube-outline"
                  label="POST_NOTIFICATIONS"
                  subtitle="Required to post the in-app test notification"
                  status={notifPerm}
                  onPress={notifPerm === 'missing' ? requestNotifPerm : undefined}
                />
              </Group>
            </>
          ) : (
            <Notice kind="info">
              Wallet notification listening is available on Android only. Proof scanning works on all platforms.
            </Notice>
          )}

          <View style={{ marginTop: SPACING.md, paddingHorizontal: SPACING.lg }}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Permissions are checked when you open this screen and when the app resumes.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}
