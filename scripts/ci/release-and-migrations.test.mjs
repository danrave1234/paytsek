import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checksum, connectionOptions } from '../../supabase/apply-migrations.mjs';
import { compareVersion, readAppVersion } from './release-version.mjs';

test('Android version extraction requires a semantic version and positive integer code', () => {
  assert.deepEqual(readAppVersion("version: '1.10.2',\nandroid: {\n versionCode: 72,\n}"), { version: '1.10.2', versionCode: 72 });
  assert.throws(() => readAppVersion("version: '1.10.2',\nversionCode: 0"));
  assert.throws(() => readAppVersion("version: '1.10.2',\nversionCode: 7.5,"));
  assert.throws(() => readAppVersion("version: '1.10.2-rc.1',\nversionCode: 72"));
  assert.ok(compareVersion('1.10.0', '1.9.99') > 0);
  assert.ok(compareVersion('v1.9.2', '1.10.0') < 0);
  assert.equal(compareVersion('1.10.0', 'v1.10.0'), 0);
});

test('remote migration connections cannot disable certificate verification via URL flags', () => {
  assert.throws(() => connectionOptions('postgres://fixture:fixture@db.example.invalid/db?sslmode=disable', {}));
  const options = connectionOptions('postgres://fixture:fixture@db.example.invalid/db?sslmode=require&sslrootcert=untrusted', {});
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  assert.equal(new URL(options.connectionString).searchParams.has('sslrootcert'), false);
  assert.equal(connectionOptions('postgres://fixture:fixture@localhost/db', {}).ssl, false);
  assert.equal(connectionOptions('postgres://fixture:fixture@127.0.0.1/db?sslmode=require', {}).ssl.rejectUnauthorized, true);
});

test('migration checksums tolerate checkout line endings but detect changed SQL', () => {
  assert.equal(checksum('select 1;\r\nselect 2;\r\n'), checksum('select 1;\nselect 2;\n'));
  assert.notEqual(checksum('select 1;'), checksum('select 2;'));
});

test('historical migrations retain the exact SQL originally applied in production', () => {
  // Verified against migration history in a read-only production transaction.
  // Original comments and retired billing seed IDs are immutable history, not branding.
  const historical = {
    '20260908000100_core.sql': '52ad111830eaf266713c0f8b5787c81687cd95b75afd60946d7b37856369ec6e',
    '20260908000200_billing_jobs.sql': 'c38e54ec22ec988e4b105accfa599492513192f6a2cdc0217ee7a1515d19b18f',
  };
  for (const [file, expected] of Object.entries(historical)) {
    assert.equal(checksum(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8')), expected);
  }
});
