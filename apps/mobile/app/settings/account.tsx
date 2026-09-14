import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { Group, ListRow, Notice, Screen } from '@/components/ui';
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
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const valid = password.length >= 8 && password === confirm;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const result = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      setPassword('');
      setConfirm('');
      setToast('Password updated');
    }
  };

  return (
    <Screen>
      <Group title="Signed in">
        <ListRow icon="email-outline" title={session?.user.email ?? 'PayTsek account'} />
      </Group>

      <View style={{ gap: SPACING.md }}>
        <View>
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>Change password</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Use at least 8 characters.</Text>
        </View>
        <TextInput label="New password" mode="outlined" secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} />} />
        <TextInput label="Confirm password" mode="outlined" secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" value={confirm} onChangeText={setConfirm} error={Boolean(confirm && password !== confirm)} />
        {confirm && password !== confirm ? <HelperText type="error" visible>Passwords do not match.</HelperText> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button mode="contained" loading={busy} disabled={!valid || busy} onPress={() => void save()} style={{ minHeight: TOUCH_TARGET }}>Update password</Button>
      </View>

      <Portal><Snackbar visible={toast !== null} duration={3000} onDismiss={() => setToast(null)}>{toast}</Snackbar></Portal>
    </Screen>
  );
}
