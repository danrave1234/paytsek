import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { finishOAuth, OAUTH_REDIRECT_URL } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const Form = z.object({
  email: z.string().email('Check your email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Form = z.infer<typeof Form>;
type Mode = 'signin' | 'signup' | 'reset';

const COPY: Record<Mode, { title: string; action: string }> = {
  signin: { title: 'Welcome back', action: 'Sign in' },
  signup: { title: 'Create account', action: 'Create account' },
  reset: { title: 'Reset password', action: 'Send reset link' },
};

export default function SignIn() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const { control, handleSubmit, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Form),
    defaultValues: { email: '', password: '' },
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage(null);
  };

  const submit = handleSubmit(async ({ email, password }) => {
    setBusy(true);
    setMessage(null);
    try {
      const auth = supabase().auth;
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error('Check your email to finish creating your account.');
      }
      router.replace('/workspaces');
    } catch (submitError) {
      setMessage({ kind: 'error', text: (submitError as Error).message });
    } finally {
      setBusy(false);
    }
  });

  const reset = async () => {
    const email = getValues('email');
    if (!email) return setMessage({ kind: 'error', text: 'Enter your email first.' });
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: 'paytsek://auth/callback' });
    setBusy(false);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Reset link sent.' });
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const WebBrowser = await import('expo-web-browser');
      WebBrowser.maybeCompleteAuthSession();
      const { data, error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Could not start Google sign-in.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw new Error('Google sign-in did not finish.');
      await finishOAuth(result.url);
      router.replace('/workspaces');
    } catch (googleError) {
      setMessage({ kind: 'error', text: (googleError as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
            <Text variant="headlineLarge" style={styles.brandName}>PayTsek</Text>
          </View>

          <View style={styles.form}>
            <Text variant="headlineSmall" style={styles.title}>{COPY[mode].title}</Text>

            {mode !== 'reset' ? (
              <Button mode="contained" icon="google" loading={busy} disabled={busy} onPress={() => void google()} contentStyle={styles.actionContent} style={styles.action}>
                Continue with Google
              </Button>
            ) : null}

            {mode !== 'reset' ? (
              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>OR</Text>
                <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
              </View>
            ) : null}

            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <TextInput
                  label="Email"
                  mode="outlined"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={!!errors.email}
                />
              )}
            />
            {errors.email ? <HelperText type="error" visible>{errors.email.message}</HelperText> : null}

            {mode !== 'reset' ? (
              <>
                <Controller
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <TextInput
                      label="Password"
                      mode="outlined"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete={mode === 'signup' ? 'new-password' : 'password'}
                      value={field.value}
                      onChangeText={field.onChange}
                      error={!!errors.password}
                      right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword((shown) => !shown)} />}
                    />
                  )}
                />
                {errors.password ? <HelperText type="error" visible>{errors.password.message}</HelperText> : null}
              </>
            ) : null}

            {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

            <Button
              mode={mode === 'reset' ? 'contained' : 'contained-tonal'}
              loading={busy}
              disabled={busy}
              onPress={() => (mode === 'reset' ? void reset() : void submit())}
              contentStyle={styles.actionContent}
              style={styles.action}
            >
              {COPY[mode].action}
            </Button>

            {mode === 'signin' ? <Button mode="text" compact onPress={() => switchMode('reset')}>Forgot password?</Button> : null}
            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {mode === 'signin' ? 'New here?' : 'Already registered?'}
              </Text>
              <Button mode="text" compact onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Create account' : 'Sign in'}
              </Button>
            </View>
          </View>

          {Platform.OS === 'android' ? (
            <Button mode="text" compact icon="cellphone-link" onPress={() => router.push('/pair/collector')}>
              Payment phone
            </Button>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 440, alignSelf: 'center', padding: SPACING.xl, gap: SPACING.xxl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logo: { width: 52, height: 52, borderRadius: RADIUS.lg },
  brandName: { fontWeight: '700', letterSpacing: -0.8 },
  form: { gap: SPACING.md },
  title: { fontWeight: '700', letterSpacing: -0.4, marginBottom: SPACING.xs },
  action: { borderRadius: RADIUS.lg },
  actionContent: { minHeight: TOUCH_TARGET },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
