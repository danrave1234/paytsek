// No application data, bodies, headers or credentials are logged or retained.
const checks = [
  { label: 'API liveness', url: 'https://api.paytsek.online/v1/health', json: true },
  { label: 'Website', url: 'https://www.paytsek.online' },
  { label: 'Root domain', url: 'https://paytsek.online' },
];
if (process.env.CRON_SECRET) checks.push({ label: 'Private API readiness', url: 'https://api.paytsek.online/v1/internal/ready', json: true, private: true });

async function check(target) {
  let failure = 'unavailable';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target.url, {
        headers: target.private ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
        signal: AbortSignal.timeout(10_000),
        redirect: target.private ? 'error' : 'follow',
      });
      const body = target.json ? await response.json() : null;
      if (!target.json) await response.body?.cancel();
      if (response.ok && (!target.json || (body.ok === true && (target.private ? body.betaModeEnabled === true && body.checks?.queue !== false && body.operationalStatus !== 'DEGRADED' : body.service === 'paytsek-api')))) return;
      failure = `HTTP ${response.status}; unhealthy response`;
    } catch { failure = 'request timed out or was unavailable'; }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`${target.label}: ${failure}`);
}

const results = await Promise.allSettled(checks.map(check));
for (const result of results) {
  if (result.status === 'rejected') { console.error(result.reason.message); process.exitCode = 1; }
}
// GitHub Actions failure subscriptions handle actionable failures. Successful runs stay quiet.
