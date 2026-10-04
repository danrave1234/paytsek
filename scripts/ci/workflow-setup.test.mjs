import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const workflows = new URL('../../.github/workflows/', import.meta.url);

test('standalone Node workflow steps disable package-manager auto-caching', () => {
  let checked = 0;
  for (const file of readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name))) {
    const lines = readFileSync(new URL(file, workflows), 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const match = /^(\s*)-\s+uses:\s+actions\/setup-node@/.exec(lines[index]);
      if (!match) continue;
      const indentation = match[1].length;
      let end = index + 1;
      while (end < lines.length && (!lines[end].trim() || /^\s*/.exec(lines[end])[0].length > indentation)) end++;
      const step = lines.slice(index, end).map((line) => line.replace(/#.*/, '')).join('\n');
      assert.match(step, /\bpackage-manager-cache:\s*false\b/, `${file}: standalone Node must not invoke an uninstalled package manager`);
      assert.doesNotMatch(step, /(?:^\s*|[{,]\s*)cache\s*:/m, `${file}: use the shared setup action when dependency caching is needed`);
      checked++;
    }
  }
  assert.ok(checked >= 2, 'Monitor and release publication must remain covered');
});

test('full dependency setup installs pnpm before enabling its cache', () => {
  const setup = readFileSync(new URL('../../.github/actions/setup/action.yml', import.meta.url), 'utf8');
  const pnpm = setup.indexOf('uses: pnpm/action-setup@');
  const node = setup.indexOf('uses: actions/setup-node@');
  assert.ok(pnpm >= 0 && node > pnpm);
  assert.match(setup, /^\s*cache:\s*pnpm\s*$/m);
  assert.match(setup, /pnpm install --frozen-lockfile/);
});
