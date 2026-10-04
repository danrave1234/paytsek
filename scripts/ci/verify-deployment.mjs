import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const config = parseEnv(readFileSync('.vercel/.env.production.local', 'utf8'));
const secret = process.env.CRON_SECRET || config.CRON_SECRET;
if (!secret) throw new Error('Matching production-api CRON_SECRET is required for readiness verification');
const expectedSha = process.env.PAYTSEK_BUILD_SHA;
if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('Expected an exact deployment commit');
const base = process.env.PAYTSEK_VERIFY_URL ?? 'https://api.paytsek.online';
if (!base.startsWith('https://')) throw new Error('Readiness verification requires HTTPS');
let lastFailure = 'No response';
for (let attempt = 0; attempt < 12; attempt += 1) {
  try {
    const response = await fetch(`${base}/v1/internal/ready`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000), redirect: 'error' });
    const body = await response.json();
    if (response.ok && body.ok === true && body.buildSha === expectedSha && body.betaModeEnabled === true) {
      console.log('Production readiness and exact deployment commit verified.');
      if (body.checks?.queue === false || body.operationalStatus === 'DEGRADED') console.log('::warning::Deployment dependencies are healthy; background queue needs operational recovery.');
      process.exit(0);
    }
    lastFailure = `HTTP ${response.status}; ready=${body.ok === true}; expectedCommit=${body.buildSha === expectedSha}; beta=${body.betaModeEnabled === true}`;
  } catch { lastFailure = 'Readiness request unavailable'; }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
throw new Error(`Production readiness failed: ${lastFailure}. Inspect deployment; do not automatically roll back database migrations.`);
