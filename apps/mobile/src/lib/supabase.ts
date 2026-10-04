import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { secureStorage } from './secure-storage';

/**
 * Supabase Auth client with the anon key only. Session tokens are kept in
 * SecureStore (Keychain / Keystore). Realtime uses the same client and RLS.
 * Large values are chunked because SecureStore limits value size.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Native OAuth returns through a custom scheme. PKCE gives that
        // callback a one-time code for exchange instead of putting session
        // tokens in the deep-link URL.
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
