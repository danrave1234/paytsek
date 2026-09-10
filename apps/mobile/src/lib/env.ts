import Constants from 'expo-constants';

interface Extra {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const env: Extra = {
  apiUrl: extra.apiUrl ?? 'http://localhost:3000',
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  sentryDsn: extra.sentryDsn ?? '',
};

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** True when the backend/auth configuration is missing (shows a setup screen instead of crashing). */
export const isConfigured = (): boolean => env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
