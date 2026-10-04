import { execFileSync } from 'node:child_process';

export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub metadata check failed (${response.status})`);
  return response.json();
}

export async function requireSuccessfulCi(sha, { waitMs = 0 } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const result = await github(`actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`);
    const latest = result.workflow_runs.filter((run) => run.head_sha === sha && run.head_branch === 'main').sort((a, b) => b.id - a.id)[0];
    if (latest?.status === 'completed') {
      if (latest.conclusion === 'success') return;
      throw new Error(`CI for ${sha} completed with ${latest.conclusion}`);
    }
    if (Date.now() >= deadline) throw new Error(`No completed successful CI push run for ${sha} on main`);
    console.log('Waiting for CI on the exact release commit...');
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}

export async function mainHead() {
  return (await github('git/ref/heads/main')).object.sha;
}
