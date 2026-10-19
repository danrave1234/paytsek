import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';
import { Loading, Notice, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { SIGN_OUT_RETRY_MESSAGE } from '@/lib/sign-out';
import { SPACING, TOUCH_TARGET } from '@/theme';

/**
 * There is no workspace picker. Signing in lands here only for the moment it
 * takes to load (or create) the account's workspace; the root gate then opens
 * Today. If that fails, offer a retry instead of a choice.
 */
export default function SettingUp() {
  const { refreshWorkspaces, signOut } = useSession();
  const [failed, setFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const enter = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setFailed(false);
    try { setFailed(!(await refreshWorkspaces())); }
    catch { setFailed(true); }
    finally { running.current = false; }
  }, [refreshWorkspaces]);

  useEffect(() => { void enter(); }, [enter]);

  const leave = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try { await signOut(); }
    catch { setError(SIGN_OUT_RETRY_MESSAGE); }
    finally { setSigningOut(false); }
  };

  if (!failed) return <Screen scroll={false}><Loading variant="dashboard" label="Setting up PayTsek" /></Screen>;
  return (
    <Screen>
      <Notice kind="error">PayTsek couldn't finish setting up. Check your connection and try again.</Notice>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <View style={{ gap: SPACING.sm }}>
        <Button mode="contained" onPress={() => void enter()} contentStyle={{ minHeight: TOUCH_TARGET }}>Try again</Button>
        <Button icon="logout" loading={signingOut} disabled={signingOut} onPress={() => void leave()}>Sign out</Button>
      </View>
    </Screen>
  );
}
