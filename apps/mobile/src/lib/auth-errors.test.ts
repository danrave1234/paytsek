import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

const err = (code: string, status = 400) => Object.assign(new Error('raw server detail'), { code, status });

describe('auth error messages', () => {
  it('tells people when the email already has an account', () => {
    expect(authErrorMessage(err('user_already_exists', 422), 'signup')).toMatch(/already exists/);
    expect(authErrorMessage(err('email_exists', 422), 'signup')).toMatch(/Sign in instead/);
  });
  it('explains password, email and rate-limit problems', () => {
    expect(authErrorMessage(err('weak_password', 422), 'signup')).toMatch(/stronger password/);
    expect(authErrorMessage(err('email_address_invalid'), 'signup')).toMatch(/valid email/);
    expect(authErrorMessage(err('', 429), 'signin')).toMatch(/Too many attempts/);
  });
  it('keeps wrong credentials generic and never echoes the server message', () => {
    const message = authErrorMessage(err('invalid_credentials'), 'signin');
    expect(message).toBe('Email or password is incorrect.');
    expect(message).not.toMatch(/raw server detail/);
  });
  it('separates network failures from account problems', () => {
    expect(authErrorMessage(new TypeError('Network request failed'), 'signup')).toMatch(/connection/);
    expect(authErrorMessage(err('something_new', 500), 'signup')).toMatch(/Could not create the account/);
  });
});
