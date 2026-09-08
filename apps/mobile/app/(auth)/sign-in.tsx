import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';
import { Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { TOUCH_TARGET } from '@/theme';

const Form = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(8, 'At least 8 characters') });
type Form = z.infer<typeof Form>;

export default function SignIn() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const { control, handleSubmit, getValues, formState: { errors } } = useForm<Form>({ resolver: zodResolver(Form), defaultValues: { email: '', password: '' } });

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
    if (!email) return setMessage({ kind: 'error', text: 'Enter your email first' });
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: 'payrecord://auth/callback' });
    setBusy(false);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Password reset email sent.' });
  };

  return (
    <Screen>
      <Text variant="headlineMedium" style={{ marginTop: 24 }}>PayRecord</Text>
      <Text variant="bodyMedium">Scan a payment proof, keep an organized record, and match it with incoming-payment evidence from your receiving phone.</Text>
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => setMode(v as typeof mode)}
        buttons={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }, { value: 'reset', label: 'Forgot' }]}
        style={{ marginTop: 12 }}
      />
      <Controller control={control} name="email" render={({ field }) => (
        <TextInput label="Email" mode="outlined" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} error={!!errors.email} />
      )} />
      <HelperText type="error" visible={!!errors.email}>{errors.email?.message}</HelperText>
      {mode !== 'reset' ? (
        <>
          <Controller control={control} name="password" render={({ field }) => (
            <TextInput label="Password" mode="outlined" secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'password'} value={field.value} onChangeText={field.onChange} error={!!errors.password} />
          )} />
          <HelperText type="error" visible={!!errors.password}>{errors.password?.message}</HelperText>
        </>
      ) : null}
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      {mode === 'reset' ? (
        <Button mode="contained" loading={busy} disabled={busy} onPress={reset} style={{ minHeight: TOUCH_TARGET }}>Send reset email</Button>
      ) : (
        <Button mode="contained" loading={busy} disabled={busy} onPress={() => void submit()} style={{ minHeight: TOUCH_TARGET }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
      )}
      <Text variant="bodySmall" style={{ marginTop: 16, opacity: 0.7 }}>
        PayRecord never asks for your GCash/GoTyme MPIN, OTP, or wallet login. It only records receipts and, with your permission, reads payment notifications on your own Android phone.
      </Text>
    </Screen>
  );
}
