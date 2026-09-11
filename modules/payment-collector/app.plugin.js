// Expo config plugin: declares the NotificationListenerService and the
// WorkManager/boot permissions in AndroidManifest. The listener itself is
// gated by the user's explicit Notification Access grant in system settings.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const SERVICE_NAME = 'ph.paytsek.collector.PayTsekNotificationListener';

module.exports = function withPaymentCollector(config) {
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE_NAME);
    app.service.push({
      $: {
        'android:name': SERVICE_NAME,
        'android:label': 'PayTsek payment notifications',
        'android:exported': 'true',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] }],
      // Android 14+: declare the listener as a plain notification listener (no elevated categories).
      'meta-data': [{ $: { 'android:name': 'android.service.notification.default_filter_types', 'android:value': 'conversations|alerting|silent' } }],
    });
    // Re-enqueue pending uploads after reboot via WorkManager's persisted queue.
    const receivers = app.receiver ?? [];
    if (!receivers.some((r) => r.$['android:name'] === 'ph.paytsek.collector.BootReceiver')) {
      receivers.push({
        $: { 'android:name': 'ph.paytsek.collector.BootReceiver', 'android:exported': 'false' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] }],
      });
    }
    app.receiver = receivers;
    return mod;
  });
};
