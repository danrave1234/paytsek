import { appendFileSync, readFileSync } from 'node:fs';
import { git, github, mainHead, requireSuccessfulCi } from './github.mjs';
import { compareVersion, readAppVersion } from './release-version.mjs';

const app = readAppVersion(readFileSync('apps/mobile/app.config.ts', 'utf8'));
const tag = `v${app.version}`;
const sha = git('rev-parse', 'HEAD');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== tag) throw new Error('Release tag must equal app.config.ts version');
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Manual APK releases must run on main');
git('fetch', 'origin', 'main', '--tags');
git('merge-base', '--is-ancestor', sha, 'origin/main');
if (await mainHead() !== sha) throw new Error('This build was superseded by newer main; release the newer commit instead');
try {
  const taggedSha = git('rev-list', '-n', '1', tag);
  if (taggedSha && taggedSha !== sha) throw new Error('Release tag belongs to a different commit');
} catch (error) {
  if (error.status !== 128) throw error;
}
for (let page = 1; ; page += 1) {
  const releases = await github(`releases?per_page=100&page=${page}`);
  for (const release of releases) {
    if (release.tag_name === tag) throw new Error('A release already exists for this version; increment version and versionCode');
    if (release.draft) continue;
    if (!release.assets.some((asset) => asset.name.endsWith('.apk'))) continue;
    const previous = readAppVersion(git('show', `${release.tag_name}:apps/mobile/app.config.ts`));
    if ((!release.prerelease && compareVersion(app.version, previous.version) <= 0) || app.versionCode <= previous.versionCode) throw new Error('Version and Android versionCode must exceed every published APK release');
  }
  if (releases.length < 100) break;
}
await requireSuccessfulCi(sha, { waitMs: process.argv.includes('--wait') ? 30 * 60_000 : 0 });
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `RELEASE_VERSION=${tag}\nRELEASE_VERSION_CODE=${app.versionCode}\nRELEASE_SHA=${sha}\n`);
console.log(`Validated immutable release ${tag}, Android code ${app.versionCode}, commit ${sha}`);
