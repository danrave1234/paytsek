import * as Haptics from 'expo-haptics';

/**
 * Restrained tactile feedback for the few moments that matter: a shutter
 * press, a saved proof, a selection change. Haptics are a courtesy, so a
 * device without a vibrator (or a disabled system setting) never surfaces
 * an error to the payment flow.
 */
function safely(run: () => Promise<void>) {
  void run().catch(() => undefined);
}

export const haptics = {
  /** A deliberate press such as the shutter or the Scan tab. */
  press: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Moving between options: tabs, filters, chart bars. */
  select: () => safely(() => Haptics.selectionAsync()),
  /** A proof is durably saved on this phone. */
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something needs the person's attention before continuing. */
  warning: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
