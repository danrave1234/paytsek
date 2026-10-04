import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const mobileRequire = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const routerRequire = createRequire(mobileRequire.resolve('expo-router/package.json'));
const queryPath = routerRequire.resolve('query-string');
const queryRequire = createRequire(queryPath);
const decode = queryRequire('decode-uri-component');
const queryString = routerRequire('query-string');

test('patched decoder retains its callable CommonJS API and legacy URI semantics', () => {
  assert.equal(typeof decode, 'function');
  for (const [input, expected] of [
    ['', ''], ['hello+world%21', 'hello world!'], ['%E2%82%B1%201%2C250.50', '₱ 1,250.50'],
    ['%F0%9F%A7%BE', '🧾'], ['%252F', '%2F'], ['%', '%'], ['%G1', '%G1'],
    ['%E2%82', '%E2%82'], ['%ED%A0%80', '%ED%A0%80'], ['%FE%FF', '��'], ['%C2', '�'],
    ['%FF%41', '%FFA'], ['%C3%A5%FF%42', 'å%FFB'],
  ]) assert.equal(decode(input), expected, `Unexpected decoding for ${input}`);
  assert.throws(() => decode(null), TypeError);
});

test('Expo Router query-string7 remains compatible after the security backport', () => {
  assert.deepEqual({ ...queryString.parse('currency=%E2%82%B1&message=hello+world&path=%252F&literal=%25') }, {
    currency: '₱', literal: '%', message: 'hello world', path: '%2F',
  });
  assert.deepEqual(queryString.parse('source=gcash&source=maya').source, ['gcash', 'maya']);
});

test('malformed percent sequences complete without recursive blowup or stack overflow', () => {
  // Isolate the historical DoS regression so a broken/unapplied patch cannot hang CI.
  const script = `const assert=require('node:assert/strict');const query=require(process.argv[1]);
    for(const count of [64,512,8192]){const value='%FF'.repeat(count)+'%E2%82%B1';
      assert.equal(query.parse('proof='+value).proof,'%FF'.repeat(count)+'₱');}
    console.log('bounded decoding verified');`;
  const result = spawnSync(process.execPath, ['-e', script, queryPath], { encoding: 'utf8', timeout: 5_000, maxBuffer: 4096 });
  assert.equal(result.error, undefined, 'Malformed query decoding timed out');
  assert.equal(result.status, 0, `Malformed query regression failed: ${result.stderr}`);
  assert.match(result.stdout, /bounded decoding verified/);
});
