import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { ErrorState, Loading, Screen } from '@/components/ui';
import { useUsage } from '@/lib/queries';
import { RADIUS, SPACING } from '@/theme';

/** Billing is intentionally absent while PayTsek is validating the beta. */
export default function Billing() {
  const usage = useUsage();
  return <Screen>
    {usage.isLoading ? <Loading /> : usage.error ? <ErrorState error={usage.error} retry={() => void usage.refetch()} /> : null}
    <Card mode="contained" style={styles.planCard}><Card.Content style={{ gap: SPACING.md }}>
      <Text variant="labelMedium">PAYTSEK BETA</Text>
      <Text variant="headlineSmall" style={{ fontWeight: '700' }}>Everything is free for now.</Text>
      <Text variant="bodyMedium">Capture receipts, connect payment phones, review records and invite your team without checkout, subscriptions or automatic charges.</Text>
      <Text variant="bodySmall" style={{ opacity: 0.72 }}>We will give you clear notice before introducing paid plans. Your records remain yours.</Text>
    </Card.Content></Card>
    <Card mode="outlined" style={styles.product}><Card.Content style={{ gap: SPACING.sm }}>
      <Text variant="titleMedium" style={{ fontWeight: '700' }}>Need a hand?</Text>
      <Text variant="bodySmall">Ask a setup question, report a notification format, or send feedback directly to the PayTsek team.</Text>
      <Button mode="outlined" icon="email-outline" onPress={() => void Linking.openURL('mailto:support@paytsek.online?subject=PayTsek%20support')}>Email support</Button>
    </Card.Content></Card>
  </Screen>;
}

const styles = StyleSheet.create({
  planCard: { borderRadius: RADIUS.xl },
  product: { borderRadius: RADIUS.lg, overflow: 'hidden' },
});
