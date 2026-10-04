import { appendFileSync } from 'node:fs';
import { git, mainHead, requireSuccessfulCi } from './github.mjs';

const sha = git('rev-parse', 'HEAD');
if (await mainHead() !== sha) {
  if (process.argv.includes('--check-only')) throw new Error('Deployment superseded before migration; rerun for current main');
  console.log('Skipping a superseded commit; current main must pass CI before deployment.');
  appendFileSync(process.env.GITHUB_OUTPUT, 'deploy=false\n');
} else {
  await requireSuccessfulCi(sha);
  if (!process.argv.includes('--check-only')) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=true\nsha=${sha}\n`);
}
