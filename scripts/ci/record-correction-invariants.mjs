// Real correction SQL against disposable localhost only. Every synthetic row
// and audit/version entry is rolled back; no Storage or remote service is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { connectionOptions } from '../../supabase/apply-migrations.mjs';

const url = process.env.DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Record correction invariants require a disposable local database');
}
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const compiled = (path) => require(fileURLToPath(new URL(`../../apps/api/dist/${path}.js`, import.meta.url)));
const { loadEnv, resetEnvCache } = compiled('config/env');
resetEnvCache();
loadEnv({ DATABASE_URL: url, SUPABASE_URL: 'http://127.0.0.1:55321',
  SUPABASE_ANON_KEY: 'synthetic-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  COLLECTOR_TOKEN_HASH_SECRET: 'synthetic-test-secret-32-characters', BETA_MODE: 'true' });
const { Client } = require('pg');
const { RecordsService } = compiled('records/records.service');
const { AuditService } = compiled('db/audit.service');
const client = new Client(connectionOptions(url));
const db = {
  query: (sql, values) => client.query(sql, values),
  one: async (sql, values) => (await client.query(sql, values)).rows[0] ?? null,
  tx: (action) => action(client), // All work belongs to the outer rollback transaction.
};
const scheduled = [];
const records = new RecordsService(db, new AuditService(db), {
  scheduleRecord: async (id) => { scheduled.push(id); },
  reconcileRecordInline: async () => undefined, // Matcher decisions have their own suite.
  candidates: async () => null,
}, {});
const owner = randomUUID(), staff = randomUUID(), org = randomUUID(), recordId = randomUUID();
const correct = (corrected, metadata = {}, isOwner = true, actor = owner) => records.correct(org, actor, isOwner, recordId, {
  corrected, reason: 'Synthetic correction', ...metadata,
});
const snapshot = async () => ({
  record: await db.one('select amount_centavos, receipt_provider, source_id, reference_value, receipt_transaction_at, evidence_state, edited_fields, note from payment_records where id=$1', [recordId]),
  active: (await db.one('select count(*)::int as n from payment_matches where record_id=$1 and active', [recordId])).n,
  versions: (await db.one('select count(*)::int as n from proof_versions where record_id=$1', [recordId])).n,
  audits: (await db.one('select count(*)::int as n from audit_events where subject_id=$1', [recordId])).n,
});

await client.connect();
try {
  await client.query('begin');
  await client.query("insert into auth.users(id,email) values ($1,'correction-owner@example.invalid'),($2,'correction-staff@example.invalid')", [owner, staff]);
  await client.query("insert into organizations(id,name,created_by) values ($1,'Synthetic corrections',$2)", [org, owner]);
  await client.query("insert into memberships(organization_id,user_id,role) values ($1,$2,'OWNER'),($1,$3,'CASHIER')", [org, owner, staff]);
  await client.query(`insert into payment_records(id,organization_id,created_by,client_record_id,capture_origin,amount_centavos,
    receipt_provider,reference_value,receipt_transaction_at,receipt_transaction_precision,evidence_state,note,captured_at)
    values ($1,$2,$3,$1,'CAMERA',125000,'GCASH','synthetic-reference','2026-10-04T02:00:00Z','MINUTE','CONFIRMED_MANUALLY','Synthetic note',now())`, [recordId, org, staff]);
  await client.query("insert into payment_matches(organization_id,record_id,kind,matcher_version) values ($1,$2,'MANUAL_OWNER_CONFIRMATION','synthetic')", [org, recordId]);

  const before = await snapshot();
  await correct({ amountCentavos: 125000, receiptProvider: 'GCASH', receiptTransactionAt: '2026-10-04T02:00:00.000Z' });
  await correct({ amountCentavos: 125000 }, {}, false, staff);
  assert.deepEqual(await snapshot(), before, 'Unchanged saves must preserve confirmations, audit and version history');
  assert.deepEqual(scheduled, []);
  await assert.rejects(correct({ receiptTransactionPrecision: 'DAY' }, {}, false, staff), { code: 'OWNER_ONLY' });
  await assert.rejects(correct({ receiptStatus: 'FAILED' }, {}, false, staff), { code: 'OWNER_ONLY' });
  await assert.rejects(correct({}, {}, false, randomUUID()), { code: 'FORBIDDEN' });
  await assert.rejects(records.correct(randomUUID(), owner, true, recordId, { corrected: {}, reason: 'Synthetic correction' }), { code: 'RECORD_NOT_FOUND' });
  assert.deepEqual(await snapshot(), before, 'Rejected corrections must not write');

  await correct({ amountCentavos: 125000 }, { note: null });
  const metadata = await snapshot();
  assert.equal(metadata.record.note, null, 'Explicit null must clear optional metadata');
  assert.equal(metadata.active, 1, 'Metadata corrections must preserve evidence');
  assert.equal(metadata.record.evidence_state, 'CONFIRMED_MANUALLY');
  assert.equal(metadata.versions, 1);
  assert.equal(metadata.audits, 1);

  await correct({ amountCentavos: 150000 });
  const amount = await snapshot();
  assert.equal(amount.record.amount_centavos, '150000');
  assert.equal(amount.record.evidence_state, 'UNVERIFIED', 'The old confirmation cannot validate a changed amount');
  assert.equal(amount.active, 0);
  assert.equal((await db.one('select count(*)::int as n from payment_matches where record_id=$1', [recordId])).n, 1, 'Previous confirmation history must remain');
  assert.deepEqual(scheduled, [recordId]);

  await correct({ receiptProvider: null, referenceValue: null, receiptTransactionAt: null });
  const cleared = await snapshot();
  assert.equal(cleared.record.receipt_provider, null);
  assert.equal(cleared.record.reference_value, null);
  assert.equal(cleared.record.receipt_transaction_at, null);
  assert.equal(cleared.record.source_id, null, 'Receipt corrections must not invent a receiving wallet');
  assert.equal(cleared.record.amount_centavos, '150000', 'Omitted fields must remain unchanged');
  await correct({ receiptProvider: null, referenceValue: null, receiptTransactionAt: null });
  assert.deepEqual(await snapshot(), cleared, 'Retrying an applied correction must not add history or reopen evidence again');
  assert.deepEqual(scheduled, [recordId, recordId]);
  console.log('Record correction invariants passed: exact changes, null clearing, permissions, evidence reopening and audit preservation.');
} finally {
  await client.query('rollback');
  await client.end();
}
