// End-to-end smoke test: create (or reuse) a confirmed test user with the secret key,
// sign in with the publishable key, then call the local API with the access token.
// Usage: node supabase/smoke-auth.mjs   (API must be running on API_PUBLIC_URL)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env'), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, API_PUBLIC_URL } = env;
const email = 'smoke-test@paytsek.local';
const password = 'Smoke-Test-Passw0rd!';

const admin = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) });
console.log('admin create user:', created.status, created.status === 422 ? '(already exists)' : '');

const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
});
const session = await login.json();
console.log('password sign-in:', login.status, session.access_token ? `alg=${JSON.parse(Buffer.from(session.access_token.split('.')[0], 'base64url')).alg}` : session);
if (!session.access_token) process.exit(1);

const bad = await fetch(`${API_PUBLIC_URL}/v1/workspaces`, { headers: { Authorization: 'Bearer not-a-token' } });
console.log('API with bad token:', bad.status, await bad.text());
const ok = await fetch(`${API_PUBLIC_URL}/v1/workspaces`, { headers: { Authorization: `Bearer ${session.access_token}` } });
console.log('API GET /v1/workspaces:', ok.status, await ok.text());
