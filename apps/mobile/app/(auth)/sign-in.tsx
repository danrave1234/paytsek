import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, TouchableRipple, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { finishOAuth, OAUTH_REDIRECT_URL } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const Form = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Form = z.infer<typeof Form>;
type Mode = 'signin' | 'signup';

export default function SignIn() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [emailOpen, setEmailOpen] = useState(false);
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
      if (mode === 'signin') {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/workspaces');
        return;
      }
      const { data, error } = await supabase().auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        setMessage({ kind: 'info', text: 'Check your email to finish creating your PayTsek account.' });
        return;
      }
      router.replace('/workspaces');
    } catch {
      setMessage({
        kind: 'error',
        text: mode === 'signin'
          ? 'Email or password is incorrect.'
          : 'Could not create the account. Try signing in or resetting the password.',
      });
    } finally {
      setBusy(false);
    }
  });

  const reset = async () => {
    const email = getValues('email').trim();
    if (!z.string().email().safeParse(email).success) {
      setEmailOpen(true);
      setMessage({ kind: 'error', text: 'Enter your email first.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: 'paytsek://auth/callback' });
      if (error) throw error;
      setMessage({ kind: 'info', text: 'If that email has an account, a reset link is on the way.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not send the reset link. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
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
      if (!data.url) throw new Error('Missing OAuth URL');
      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw new Error('OAuth did not complete');
      await finishOAuth(result.url);
      router.replace('/workspaces');
    } catch {
      setMessage({ kind: 'error', text: 'Google sign-in did not finish. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
            <Text variant="headlineMedium" style={[styles.brandName, { color: theme.colors.primary }]}>PayTsek</Text>
          </View>

          <View style={styles.intro}>
            <Text variant="headlineLarge" style={styles.title}>Record QR payments in seconds.</Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Scan the proof. Keep the record. Check wallet evidence when it is available.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              mode="contained"
              icon="google"
              loading={busy}
              disabled={busy}
              onPress={() => void google()}
              contentStyle={styles.actionContent}
              style={styles.primaryAction}
            >
              Continue with Google
            </Button>
            <Button
              mode="outlined"
              icon="email-outline"
              disabled={busy}
              onPress={() => setEmailOpen((open) => !open)}
              contentStyle={styles.actionContent}
              style={styles.secondaryAction}
            >
              {emailOpen ? 'Hide email' : 'Continue with email'}
            </Button>
          </View>

          {emailOpen ? (
            <View style={[styles.emailPanel, { borderTopColor: theme.colors.outlineVariant }]}>
              <View style={styles.modeRow} accessibilityRole="tablist">
                {(['signin', 'signup'] as const).map((item) => (
                  <TouchableRipple
                    key={item}
                    onPress={() => switchMode(item)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === item }}
                    style={[styles.mode, mode === item && { borderBottomColor: theme.colors.primary }]}
                  >
                    <Text variant="labelLarge" style={{ color: mode === item ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                      {item === 'signin' ? 'Sign in' : 'Create account'}
                    </Text>
                  </TouchableRipple>
                ))}
              </View>

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
                    outlineStyle={styles.inputOutline}
                  />
                )}
              />
              {errors.email ? <HelperText type="error" visible>{errors.email.message}</HelperText> : null}

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
                    outlineStyle={styles.inputOutline}
                    right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword((shown) => !shown)} />}
                  />
                )}
              />
              {errors.password ? <HelperText type="error" visible>{errors.password.message}</HelperText> : null}

              {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

              <Button mode="contained" loading={busy} disabled={busy} onPress={() => void submit()} contentStyle={styles.actionContent} style={styles.primaryAction}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              {mode === 'signin' ? <Button mode="text" compact disabled={busy} onPress={() => void reset()}>Forgot password?</Button> : null}
            </View>
          ) : message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

          <Text variant="bodySmall" style={[styles.legal, { color: theme.colors.onSurfaceVariant }]}>
            By continuing, you agree to the{' '}
            <Text onPress={() => void Linking.openURL('https://paytsek.online/terms')} style={{ color: theme.colors.primary }}>Terms</Text>
            {' '}and acknowledge the{' '}
            <Text onPress={() => void Linking.openURL('https://paytsek.online/privacy')} style={{ color: theme.colors.primary }}>Privacy Notice</Text>.
          </Text>

          {Platform.OS === 'android' ? (
            <Button mode="text" compact icon="cellphone-link" onPress={() => router.push('/pair/collector')}>
              Set up a payment phone
            </Button>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', maxWidth: 440, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xlg, paddingVertical: SPACING.xxl, gap: SPACING.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  logo: { width: 48, height: 48 },
  brandName: { fontWeight: '800', letterSpacing: -0.7 },
  intro: { gap: SPACING.md },
  title: { maxWidth: 360, fontWeight: '800', letterSpacing: -1 },
  actions: { gap: SPACING.sm },
  primaryAction: { borderRadius: RADIUS.lg },
  secondaryAction: { borderRadius: RADIUS.lg },
  actionContent: { minHeight: TOUCH_TARGET + 4 },
  emailPanel: { gap: SPACING.sm, paddingTop: SPACING.lg, borderTopWidth: StyleSheet.hairlineWidth },
  modeRow: { flexDirection: 'row' },
  mode: { flex: 1, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  inputOutline: { borderRadius: RADIUS.md },
  legal: { textAlign: 'center', lineHeight: 19 },
});
