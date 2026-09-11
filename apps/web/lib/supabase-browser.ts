'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Browser-only client. The publishable anonymous key identifies the project;
 * row access is still governed by the signed-in user's Supabase access token.
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('The dashboard is not configured yet. Missing public Supabase settings.');
  }

  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
