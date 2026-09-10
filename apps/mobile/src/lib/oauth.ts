import { supabase } from './supabase';

export const OAUTH_REDIRECT_URL = 'paytsek://auth/callback';

let exchangeInFlight: Promise<void> | null = null;

/**
 * Finish one PKCE callback exactly once, even when both Expo Router and the
 * authenticated browser session observe the same Android deep link.
 */
export async function finishOAuth(url: string): Promise<void> {
  const callback = new URL(url);
  const providerError = callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (providerError) throw new Error(providerError);
  if (!callback.searchParams.get('code')) throw new Error('Google did not return a sign-in code. Please try again.');

  const { data: current } = await supabase().auth.getSession();
  if (current.session) return;
  if (exchangeInFlight) return exchangeInFlight;

  exchangeInFlight = (async () => {
    const { error } = await supabase().auth.exchangeCodeForSession(url);
    if (error) throw error;
  })();

  try {
    await exchangeInFlight;
  } finally {
    exchangeInFlight = null;
  }
}
