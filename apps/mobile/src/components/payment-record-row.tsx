import type { EvidenceState } from '@paytsek/contracts';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { ProviderLogo } from '@/components/provider-logo';
import { peso, stateLabel, transactionTime } from '@/lib/format';
import { SPACING, TOUCH_TARGET, stateColorsFor } from '@/theme';

type Props = {
  amountCentavos: number;
  occurredAt: string;
  sourceLabel: string;
  state?: EvidenceState;
  timezone?: string;
  onPress?: () => void;
  onPressIn?: () => void;
  divider?: boolean;
};

/**
 * The V2 ledger intentionally displays only facts available from a proof:
 * time, evidence state, amount and source. Never add invented customer or item data.
 */
export function PaymentRecordRow({
  amountCentavos,
  occurredAt,
  sourceLabel,
  state = 'UNVERIFIED',
  timezone = 'Asia/Manila',
  onPress,
  onPressIn,
  divider = false,
}: Props) {
  const theme = useTheme();
  const evidence = stateColorsFor(theme.dark)[state];
  const content = (
    <View
      style={[
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outlineVariant },
      ]}
    >
      <Text variant="bodyMedium" style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
        {transactionTime(occurredAt, timezone)}
      </Text>
      <View style={[styles.verticalRule, { backgroundColor: theme.colors.outlineVariant }]} />
      <ProviderLogo label={sourceLabel} size={42} />
      <View style={styles.sourceBlock}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.source}>
          {sourceLabel}
        </Text>
        <View accessibilityRole="text" accessibilityLabel={`Status: ${stateLabel(state)}`} style={styles.evidence}>
          <View style={[styles.evidenceDot, { backgroundColor: evidence.fg }]} />
          <Text variant="labelSmall" numberOfLines={1} style={{ color: evidence.fg, fontWeight: '700' }}>
            {stateLabel(state)}
          </Text>
        </View>
      </View>
      <Text
        variant="titleMedium"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={styles.amount}
      >
        {peso(amountCentavos)}
      </Text>
      {onPress ? <Icon source="chevron-right" size={18} color={theme.colors.onSurfaceVariant} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableRipple
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={`${sourceLabel}, ${peso(amountCentavos)}, ${stateLabel(state)}, ${transactionTime(occurredAt, timezone)}`}
    >
      {content}
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  time: {
    width: 66,
    fontVariant: ['tabular-nums'],
  },
  verticalRule: {
    width: StyleSheet.hairlineWidth,
    height: 42,
    marginRight: 2,
  },
  sourceBlock: {
    flex: 1,
    minWidth: 76,
    gap: 2,
  },
  source: {
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  evidence: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  amount: {
    maxWidth: 102,
    minHeight: TOUCH_TARGET,
    textAlignVertical: 'center',
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
});
