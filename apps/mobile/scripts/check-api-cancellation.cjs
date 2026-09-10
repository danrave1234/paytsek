const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
let fetchImplementation;
vm.runInNewContext(compiled, {
  exports: exported, AbortController, setTimeout, clearTimeout,
  fetch: (...args) => fetchImplementation(...args),
  require: (name) => {
    if (name === '@paytsek/contracts') return { API_VERSION_HEADER: 'x-api-version', WORKSPACE_HEADER: 'x-workspace' };
    if (name === './env') return { env: { apiUrl: 'https://example.invalid' } };
    if (name === './supabase') return { getAccessToken: async () => 'test-token' };
    if (name === './workspace') return { getActiveWorkspaceId: async () => 'test-workspace' };
    throw new Error(`Unexpected import ${name}`);
  },
});

async function main() {
  let receivedSignal;
  fetchImplementation = async (_url, options) => {
    receivedSignal = options.signal;
    return { status: 200, ok: true, text: () => new Promise((_resolve, reject) => {
      const fail = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
      if (options.signal.aborted) fail();
      else options.signal.addEventListener('abort', fail, { once: true });
    }) };
  };
  const controller = new AbortController();
  const pending = exported.api('/v1/records', { signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError' && !(error instanceof exported.OfflineError));
  assert.equal(receivedSignal.aborted, true);
  await assert.rejects(exported.api('/v1/records', { timeoutMs: 5 }), (error) => error instanceof exported.OfflineError);
  fetchImplementation = async () => ({ status: 200, ok: true, text: async () => '{"ok":true}' });
  assert.equal((await exported.api('/v1/records')).ok, true);
  console.log('PASS: cancellation reaches body read, cancellation is not reported as offline, timeout and success work.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
