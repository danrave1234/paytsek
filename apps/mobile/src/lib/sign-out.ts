export const SIGN_OUT_RETRY_MESSAGE = 'Could not sign out. You are still signed in. Reconnect and try again.';

/** A returned error is not proof of logout or failure: the SDK event is authoritative. */
export async function signOutConfirmed(
  signOut: () => Promise<{ error: unknown }>,
  signedOut: () => boolean,
  clearAccountCache: () => Promise<void>,
): Promise<void> {
  try { await signOut(); } catch { /* Storage and network failures are checked against the auth event below. */ }
  // An expired-session refresh can fail before the SDK removes its session.
  // Conversely a logout HTTP failure can still remove it and emit SIGNED_OUT.
  if (!signedOut()) throw new Error(SIGN_OUT_RETRY_MESSAGE);
  await clearAccountCache();
}
