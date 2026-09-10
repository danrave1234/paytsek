import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { finishOAuth, OAUTH_REDIRECT_URL } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const Form = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof Form>;

type Mode = 'signin' | 'signup' | 'reset';

WebBrowser.maybeCompleteAuthSession();

/** Headline and supporting copy per mode, so the screen always says where you are. */
const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to keep recording your payments.', cta: 'Sign in' },
  signup: { title: 'Create your account', subtitle: 'Start keeping a record of every payment you receive.', cta: 'Create account' },
  reset: { title: 'Reset your password', subtitle: 'We will email you a link to choose a new one.', cta: 'Send reset link' },
};

export default function SignIn() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(Form), defaultValues: { email: '', password: '' } });

  const go = (next: Mode) => {
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
        router.replace('/workspaces');
      } else {
        const { data, error } = await auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error('Your account was created but sign-in did not finish. Please sign in once.');
        router.replace('/workspaces');
      }
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  });

  const reset = async () => {
    const email = getValues('email');
    if (!email) return setMessage({ kind: 'error', text: 'Enter your email address first.' });
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: 'paytsek://auth/callback' });
    setBusy(false);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Password reset email sent.' });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const redirectTo = OAUTH_REDIRECT_URL;
      const { data, error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in could not be started.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setMessage({ kind: 'info', text: 'Google sign-in was cancelled.' });
        return;
      }
      if (result.type !== 'success') throw new Error('Google sign-in could not be completed. Please try again.');
      await finishOAuth(result.url);
      router.replace('/workspaces');
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.shell}>
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.logoFrame,
                  { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.outlineVariant },
                ]}
              >
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
              <View>
                <Text variant="titleLarge">PayTsek</Text>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Payments, checked.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outlineVariant,
                  shadowColor: theme.colors.shadow,
                },
              ]}
            >
              <View style={styles.heading}>
                <Text variant="headlineSmall" style={styles.title}>
                  {copy.title}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {copy.subtitle}
                </Text>
              </View>

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <TextInput
                    label="Email"
                    mode="outlined"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    left={<TextInput.Icon icon="email-outline" />}
                    value={field.value}
                    onChangeText={field.onChange}
                    error={!!errors.email}
                    outlineStyle={styles.inputOutline}
                  />
                )}
              />
              {errors.email ? (
                <HelperText type="error" visible>
                  {errors.email.message}
                </HelperText>
              ) : null}

              {mode !== 'reset' ? (
                <>
                  <View style={{ marginTop: errors.email ? 0 : SPACING.md }}>
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
                          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                          left={<TextInput.Icon icon="lock-outline" />}
                          right={
                            <TextInput.Icon
                              icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                              onPress={() => setShowPassword((v) => !v)}
                              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                            />
                          }
                          value={field.value}
                          onChangeText={field.onChange}
                          error={!!errors.password}
                          onSubmitEditing={() => void submit()}
                          returnKeyType="go"
                          outlineStyle={styles.inputOutline}
                        />
                      )}
                    />
                  </View>
                  {errors.password ? (
                    <HelperText type="error" visible>
                      {errors.password.message}
                    </HelperText>
                  ) : null}

                  {mode === 'signin' ? (
                    <Button
                      mode="text"
                      compact
                      onPress={() => go('reset')}
                      style={styles.forgot}
                    >
                      Forgot password?
                    </Button>
                  ) : null}
                </>
              ) : null}

              {message ? (
                <View style={{ marginTop: SPACING.md }}>
                  <Notice kind={message.kind}>{message.text}</Notice>
                </View>
              ) : null}

              <Button
                mode="contained"
                loading={busy}
                disabled={busy}
                onPress={() => (mode === 'reset' ? void reset() : void submit())}
                style={styles.primaryButton}
                contentStyle={styles.buttonContent}
              >
                {copy.cta}
              </Button>

              {mode !== 'reset' ? (
                <>
                  <View style={styles.dividerRow}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      OR
                    </Text>
                    <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                  </View>
                  <Button
                    mode="outlined"
                    icon="google"
                    loading={busy}
                    disabled={busy}
                    onPress={() => void signInWithGoogle()}
                    style={styles.secondaryButton}
                    contentStyle={styles.buttonContent}
                  >
                    Continue with Google
                  </Button>
                </>
              ) : null}

              <View style={styles.modeSwitch}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {mode === 'signin' ? 'New to PayTsek?' : 'Already have an account?'}
                </Text>
                <Button mode="text" compact onPress={() => go(mode === 'signin' ? 'signup' : 'signin')}>
                  {mode === 'signin' ? 'Create account' : 'Sign in'}
                </Button>
              </View>

              <View style={[styles.safetyRow, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon source="shield-check-outline" size={17} color={theme.colors.onSurfaceVariant} />
                <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
                  Never share your wallet MPIN or OTP with anyone.
                </Text>
              </View>
            </View>

            {Platform.OS === 'android' ? (
              <Button
                icon="cellphone-link"
                mode="text"
                compact
                onPress={() => router.push('/pair/collector')}
                style={styles.pairButton}
              >
                Set up a payment phone with a pairing code
              </Button>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  shell: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  logoFrame: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 3,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xlg,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  heading: {
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  inputOutline: {
    borderRadius: RADIUS.lg,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: SPACING.xxs,
  },
  primaryButton: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  secondaryButton: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  buttonContent: {
    minHeight: TOUCH_TARGET,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  divider: {
    height: 1,
    flex: 1,
  },
  modeSwitch: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  safetyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  pairButton: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
});
