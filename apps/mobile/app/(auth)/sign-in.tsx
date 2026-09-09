import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, HelperText, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Notice } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { RADIUS, SPACING, TOUCH_TARGET } from '@/theme';

const Form = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof Form>;

type Mode = 'signin' | 'signup' | 'reset';

/** Headline and supporting copy per mode, so the screen always says where you are. */
const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to keep recording your payments.', cta: 'Sign in' },
  signup: { title: 'Create your account', subtitle: 'Start keeping a record of every payment you receive.', cta: 'Create account' },
  reset: { title: 'Reset your password', subtitle: 'We will email you a link to choose a new one.', cta: 'Send reset link' },
};

export default function SignIn() {
  const theme = useTheme();
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
      } else {
        const { error } = await auth.signUp({ email, password, options: { emailRedirectTo: 'payrecord://auth/callback' } });
        if (error) throw error;
        setMessage({ kind: 'info', text: 'Check your email to verify your account, then sign in.' });
        setMode('signin');
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
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: 'payrecord://auth/callback' });
    setBusy(false);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Password reset email sent.' });
  };

  const copy = COPY[mode];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACING.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Brand ------------------------------------------------------- */}
          <View style={{ alignItems: 'center', marginBottom: SPACING.xxl }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: 64, height: 64, borderRadius: RADIUS.lg }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text variant="headlineSmall" style={{ marginTop: SPACING.lg, fontWeight: '700', letterSpacing: -0.4 }}>
              {copy.title}
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginTop: SPACING.sm, textAlign: 'center', color: theme.colors.onSurfaceVariant, maxWidth: 300 }}
            >
              {copy.subtitle}
            </Text>
          </View>

          {/* Form -------------------------------------------------------- */}
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
              />
            )}
          />
          {/* Rendered only when there is something to say, so the gap below
              the field does not sit empty. */}
          {errors.email ? (
            <HelperText type="error" visible>
              {errors.email.message}
            </HelperText>
          ) : null}

          {mode !== 'reset' ? (
            <>
              <View style={{ marginTop: errors.email ? 0 : SPACING.lg }}>
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
                  style={{ alignSelf: 'flex-end', marginTop: errors.password ? 0 : SPACING.xs }}
                >
                  Forgot password?
                </Button>
              ) : null}
            </>
          ) : null}

          {message ? (
            <View style={{ marginTop: SPACING.lg }}>
              <Notice kind={message.kind}>{message.text}</Notice>
            </View>
          ) : null}

          <Button
            mode="contained"
            loading={busy}
            disabled={busy}
            onPress={() => (mode === 'reset' ? void reset() : void submit())}
            style={{ marginTop: SPACING.xl, minHeight: TOUCH_TARGET, justifyContent: 'center' }}
            contentStyle={{ minHeight: TOUCH_TARGET }}
          >
            {copy.cta}
          </Button>

          {/* Mode switch — one link, not a segmented control ------------- */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xl }}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {mode === 'signin' ? 'New to PayRecord?' : 'Already have an account?'}
            </Text>
            <Button mode="text" compact onPress={() => go(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </Button>
          </View>

          {/* Safety note — the one thing worth reading, so it gets an icon
              rather than being a wall of small print. */}
          <View
            style={{
              flexDirection: 'row',
              gap: SPACING.md,
              alignItems: 'flex-start',
              marginTop: SPACING.xxl,
              padding: SPACING.md,
              borderRadius: RADIUS.md,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Icon source="shield-check-outline" size={18} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
              PayRecord never asks for your GCash, GoTyme, Maya or MariBank MPIN, OTP, or wallet login.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
