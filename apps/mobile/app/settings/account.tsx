import React, { useState } from 'react';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { SPACING, TOUCH_TARGET } from '@/theme';

export default function Account() {
  const theme = useTheme();
  const { session } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const valid = password.length >= 8 && password === confirm;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setPassword(''); setConfirm(''); setMessage({ kind: 'info', text: 'Password updated. Keep it private and do not reuse it on another service.' }); }
  };
  return (
    <Screen>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{session?.user.email ?? 'Signed-in account'}</Text>
      <Text variant="titleMedium" style={{ marginTop: SPACING.sm }}>Change password</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Choose a new password with at least 8 characters. You remain signed in on this device.</Text>
      <TextInput label="New password" mode="outlined" secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} />} />
      <TextInput label="Confirm new password" mode="outlined" secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" value={confirm} onChangeText={setConfirm} error={!!confirm && password !== confirm} />
      {confirm && password !== confirm ? <HelperText type="error" visible>Passwords do not match.</HelperText> : null}
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <Button mode="contained" loading={busy} disabled={!valid || busy} onPress={() => void save()} style={{ minHeight: TOUCH_TARGET }}>Update password</Button>
    </Screen>
  );
}
