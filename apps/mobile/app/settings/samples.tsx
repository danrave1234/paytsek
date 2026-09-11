import { PROVIDER_LABELS, type Provider } from '@paytsek/contracts';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Button, Card, Switch, Text, useTheme } from 'react-native-paper';
import { PaymentCollector, type TemplateSample } from 'payment-collector';
import { EmptyState, Group, ListRow, Notice, Screen } from '@/components/ui';
import { SPACING, TOUCH_TARGET } from '@/theme';

/**
 * Owner tool for adding wallet support. A wallet can only be matched once we
 * know what its notification actually looks like, and unrecognised
 * notifications are normally discarded on the phone. Turning this on keeps a
 * redacted copy of the *shape* so a parser can be written against it.
 */
export default function Samples() {
  const theme = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [samples, setSamples] = useState<TemplateSample[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEnabled(await PaymentCollector.isCaptureUnknownTemplates());
    setSamples(await PaymentCollector.listTemplateSamples());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await PaymentCollector.setCaptureUnknownTemplates(next);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const json = await PaymentCollector.exportTemplateSamples();
    await Share.share({ message: json, title: 'PayTsek notification shapes' });
  };

  const clear = async () => {
    await PaymentCollector.clearTemplateSamples();
    await refresh();
  };

  if (Platform.OS !== 'android') {
    return (
      <Screen>
        <EmptyState
          icon="cellphone-off"
          title="Android only"
          body="Notification formats can only be captured on the Android phone that receives your payment notifications."
        />
      </Screen>
    );
  }

  // Group by wallet so it is obvious which one still needs a sample.
  const byProvider = samples.reduce<Partial<Record<Provider, TemplateSample[]>>>((acc, s) => {
    (acc[s.provider] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Screen>
      <Notice kind="info">When enabled, unrecognised payment-notification shapes are redacted and stored only on this phone. OTPs and security messages are excluded.</Notice>

      <Group title="Capture">
        <ListRow
          icon="text-search"
          title="Capture unknown formats"
          subtitle={enabled ? 'Recording redacted shapes on this phone' : 'Off — nothing is stored'}
          right={<Switch value={enabled} disabled={busy} onValueChange={(v) => void toggle(v)} />}
        />
      </Group>

      {enabled && samples.length === 0 ? (
        <Notice kind="warning">
          No unknown format captured yet. Leave this enabled until the next payment notification arrives.
        </Notice>
      ) : null}

      {samples.length > 0 ? (
        <>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700', marginTop: SPACING.md }}>
            {samples.length} shape{samples.length === 1 ? '' : 's'} captured
          </Text>

          {(Object.keys(byProvider) as Provider[]).map((provider) => (
            <Card key={provider} mode="contained" style={{ backgroundColor: theme.colors.elevation.level1 }}>
              <Card.Title title={PROVIDER_LABELS[provider]} subtitle={`${byProvider[provider]!.length} unrecognised`} />
              <Card.Content style={{ gap: SPACING.sm }}>
                {byProvider[provider]!.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      gap: 4,
                      padding: SPACING.md,
                      borderRadius: 12,
                      backgroundColor: theme.colors.surfaceVariant,
                    }}
                  >
                    {s.title ? (
                      <Text variant="labelSmall" style={{ fontWeight: '700' }} numberOfLines={2}>
                        {s.title}
                      </Text>
                    ) : null}
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={4}>
                      {s.bigText ?? s.text ?? '(no body)'}
                    </Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
                      {s.appVersionName ? `app ${s.appVersionName} · ` : ''}
                      {s.capturedAt.slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          ))}

          <Button mode="contained" icon="share-variant" onPress={() => void share()} style={{ minHeight: TOUCH_TARGET }}>
            Share with support
          </Button>
          <Button mode="text" textColor={theme.colors.error} onPress={() => void clear()} style={{ minHeight: TOUCH_TARGET }}>
            Delete captured shapes
          </Button>
        </>
      ) : null}
    </Screen>
  );
}
