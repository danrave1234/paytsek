/**
 * Plain-language sign-in and sign-up failures. Supabase returns a stable
 * `code`; the raw message is never shown because it can echo server detail.
 */
export type AuthMode = 'signin' | 'signup';

export function authErrorMessage(error: unknown, mode: AuthMode): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : NaN;

  switch (code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Sign in instead, or reset the password.';
    case 'weak_password':
      return 'Choose a stronger password: at least 8 characters with letters and numbers.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Enter a valid email address.';
    case 'email_not_confirmed':
      return 'Confirm your email first. Check your inbox for the PayTsek link.';
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Email sign-up is not available right now. Continue with Google instead.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a few minutes, then try again.';
    default:
      break;
  }
  if (status === 429) return 'Too many attempts. Wait a few minutes, then try again.';
  if (!code && Number.isNaN(status)) return 'Could not reach PayTsek. Check your connection and try again.';
  return mode === 'signin'
    ? 'Email or password is incorrect.'
    : 'Could not create the account. Try signing in or resetting the password.';
}
