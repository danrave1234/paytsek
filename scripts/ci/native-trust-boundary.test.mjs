import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('collector preserves the Android package as evidence authority even for diagnostics', () => {
  const listener = readFileSync(new URL('../../modules/payment-collector/android/src/main/java/ph/paytsek/collector/PayTsekNotificationListener.kt', import.meta.url), 'utf8');
  // Regression guard for the prior diagnostic path that substituted a trusted wallet package.
  assert.doesNotMatch(listener, /\bTEST_SOURCE_PACKAGE\b|\bval\s+isTest\b/);
  assert.match(listener, /val sourcePackage = sbn\.packageName/);
  const ownPackage = listener.indexOf('if (sbn.packageName == packageName)');
  const packageRead = listener.indexOf('val sourcePackage = sbn.packageName');
  assert.ok(ownPackage >= 0 && ownPackage < packageRead);
  assert.match(listener.slice(ownPackage, packageRead), /\breturn\b/);
});
