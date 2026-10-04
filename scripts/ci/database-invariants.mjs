// Deliberately refuses remote databases. Fixtures never leave this rolled-back local transaction.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { connectionOptions } from '../../supabase/apply-migrations.mjs';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
require('reflect-metadata');
const { JobsService } = require(fileURLToPath(new URL('../../apps/api/dist/jobs/jobs.service.js', import.meta.url)));
const url = process.env.DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Database invariants may only run on disposable local Supabase');
const client = new Client(connectionOptions(url));
const jobs = new JobsService({
  query: (sql, values) => client.query(sql, values),
  one: async (sql, values) => (await client.query(sql, values)).rows[0] ?? null,
  tx: (action) => action(client), // This suite already owns the outer rollback transaction.
});
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), cashier = id(2), other = id(3), org = id(10), otherOrg = id(11), source = id(20), otherSource = id(21), device = id(30);
let assertion = 0;
async function rejectsSql(sql, params, expectedCode) {
  const savepoint = `expected_${++assertion}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await assert.rejects(() => client.query(sql, params), (error) => error.code === expectedCode);
  } finally {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
  }
}
async function asUser(user, action) {
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
  await client.query('set local role authenticated');
  try { await action(); } finally { await client.query('reset role'); }
}
async function count(table) {
  return Number((await client.query(`select count(*) as n from ${table}`)).rows[0].n);
}

await client.connect();
try {
  await client.query('begin');
  await client.query("insert into auth.users(id,email) values ($1,'owner@example.invalid'),($2,'cashier@example.invalid'),($3,'other@example.invalid')", [owner, cashier, other]);
  await client.query("insert into organizations(id,name,created_by) values ($1,'Synthetic A',$2),($3,'Synthetic B',$4)", [org, owner, otherOrg, other]);
  await client.query("insert into memberships(organization_id,user_id,role) values ($1,$2,'OWNER'),($1,$3,'CASHIER'),($4,$5,'OWNER')", [org, owner, cashier, otherOrg, other]);
  await client.query("insert into payment_sources(id,organization_id,provider,label,declared_identifier,masked_display) values ($1,$2,'GCASH','Synthetic wallet','synthetic','synthetic'),($3,$4,'GCASH','Other wallet','synthetic','synthetic')", [source, org, otherSource, otherOrg]);
  await client.query("insert into devices(id,organization_id,install_id,label,platform,capability,credential_hash) values ($1,$2,$3,'Synthetic device','ANDROID','BOTH','synthetic-hash')", [device, org, id(31)]);
  for (const [recordId, workspace, author, wallet] of [[id(40), org, owner, source], [id(41), org, cashier, source], [id(42), otherOrg, other, otherSource]]) {
    await client.query("insert into payment_records(id,organization_id,created_by,source_id,client_record_id,capture_origin,amount_centavos,captured_at) values ($1,$2,$3,$4,$1,'CAMERA',10000,now())", [recordId, workspace, author, wallet]);
  }
  await client.query(`insert into notification_events(id,organization_id,source_id,device_id,client_event_id,provider,source_package,parser_id,parser_version,payment_rail,amount_centavos,reference_namespace,posted_at,captured_at,monotonic_capture_ms,boot_session_id,lifecycle_dedup_key,normalized_text_sha256)
    values ($1,$2,$3,$4,$1,'GCASH','com.globe.gcash.android','synthetic','1','UNKNOWN',10000,'UNKNOWN',now(),now(),1,'synthetic','synthetic',$5)`, [id(50), org, source, device, '0'.repeat(64)]);

  await asUser(cashier, async () => {
    assert.equal(await count('payment_records'), 1, 'Cashier must see only their own workspace records');
    assert.equal(await count('notification_events'), 0, 'Cashier must not read the notification inbox directly');
    assert.equal((await client.query('select id from devices')).rowCount, 1, 'Cashier may read allowed device health columns');
    await rejectsSql('select credential_hash from devices', [], '42501');
    await rejectsSql('select declared_identifier from payment_sources', [], '42501');
    await rejectsSql('select * from account_deletions', [], '42501');
  });
  await asUser(owner, async () => {
    assert.equal(await count('payment_records'), 2, 'Owner must see their full workspace and no other workspace');
    assert.equal(await count('notification_events'), 1, 'Owner must see workspace evidence');
  });
  await rejectsSql("insert into payment_records(organization_id,created_by,client_record_id,capture_origin,amount_centavos,captured_at) values ($1,$2,$3,'CAMERA',10000,now())", [org, cashier, id(41)], '23505');
  await rejectsSql("insert into payment_matches(organization_id,record_id,event_id,kind,matcher_version) values ($1,$2,$3,'AUTO','synthetic')", [otherOrg, id(42), id(50)], '23514');
  await client.query("insert into payment_matches(organization_id,record_id,event_id,kind,matcher_version) values ($1,$2,$3,'AUTO','synthetic')", [org, id(40), id(50)]);
  await rejectsSql("insert into payment_matches(organization_id,record_id,event_id,kind,matcher_version) values ($1,$2,$3,'AUTO','synthetic')", [org, id(41), id(50)], '23505');

  await jobs.enqueue('RECONCILE_RECORD', { recordId: id(40) }, 'synthetic-revision', client);
  const firstToken = await jobs.pendingToken('synthetic-revision');
  await jobs.enqueue('RECONCILE_RECORD', { recordId: id(40) }, 'synthetic-revision', client);
  await jobs.completeInline(firstToken);
  assert.ok(await jobs.pendingToken('synthetic-revision'), 'Old inline completion must preserve work enqueued during reconciliation');
  await jobs.completeInline(await jobs.pendingToken('synthetic-revision'));
  assert.equal(await jobs.pendingToken('synthetic-revision'), null);
  await jobs.enqueue('RECONCILE_RECORD', { recordId: id(40) }, 'synthetic-lease', client);
  const [oldLease] = await jobs.lease('synthetic-worker-a', 1, 60);
  await client.query("update jobs set leased_until=now()-interval '1 second' where id=$1", [oldLease.id]);
  const [newLease] = await jobs.lease('synthetic-worker-b', 1, 60);
  await jobs.complete(oldLease);
  assert.equal((await client.query('select status from jobs where id=$1', [oldLease.id])).rows[0].status, 'LEASED', 'An expired worker must not acknowledge a newer lease');
  await jobs.complete(newLease);

  // Progress resets attempts, so attempts alone cannot fence an older worker.
  // Exercise the real lease/defer SQL through the rev1/attempt1 -> rev2/attempt1 ABA.
  const deletion = (await client.query('insert into account_deletions(subject_hash,user_id) values ($1,$2) returning id',
    [createHash('sha256').update(owner).digest('hex'), owner])).rows[0];
  await jobs.enqueue('DELETE_ACCOUNT', { requestId: deletion.id }, 'synthetic-aba', client);
  await client.query("update jobs set max_attempts=1 where dedupe_key='synthetic-aba'");
  const [originalLease] = await jobs.lease('synthetic-aba-old', 1, 60);
  await client.query("update jobs set leased_until=now()-interval '1 second' where id=$1", [originalLease.id]);
  const [resumedLease] = await jobs.lease('synthetic-aba-resumed', 1, 60);
  await jobs.defer(resumedLease, 1);
  await client.query('update jobs set run_after=now() where id=$1', [originalLease.id]);
  const [freshLease] = await jobs.lease('synthetic-aba-fresh', 1, 60);
  assert.equal(freshLease.attempts, originalLease.attempts);
  assert.ok(freshLease.revision > originalLease.revision, 'Progress defer must fence the old lease before resetting attempts');
  await jobs.complete(originalLease);
  await jobs.fail(originalLease, 'synthetic obsolete failure');
  await jobs.defer(originalLease);
  const fenced = (await client.query('select status,revision,attempts from jobs where id=$1', [freshLease.id])).rows[0];
  assert.deepEqual(fenced, { status: 'LEASED', revision: freshLease.revision, attempts: freshLease.attempts });
  assert.equal((await client.query('select status from account_deletions where id=$1', [deletion.id])).rows[0].status, 'PENDING',
    'An obsolete terminal worker must not mark account deletion failed');
  await jobs.complete(freshLease);
  assert.equal((await client.query('select status from jobs where id=$1', [freshLease.id])).rows[0].status, 'DONE');
  await client.query('delete from account_deletions where id=$1', [deletion.id]);

  await client.query("insert into payment_records(id,organization_id,created_by,client_record_id,capture_origin,amount_centavos,captured_at) values ($1,$2,$3,$1,'CAMERA',10000,now())", [id(44), org, cashier]);
  assert.equal((await client.query('select source_id from payment_records where id=$1', [id(44)])).rows[0].source_id, null, 'A proof record must persist before supplementary evidence identifies a receiving wallet');

  await client.query("insert into payment_proofs(id,organization_id,client_proof_id,uploaded_by,content_type,byte_length,sha256,retention_days,retention_until) values ($1,$2,$1,$3,'image/jpeg',1,$4,30,now()+interval '30 days')", [id(60), org, cashier, '1'.repeat(64)]);
  // Replay the actual additive SQL against a pre-expiry schema inside a local
  // savepoint, including an already-purged legacy manifest, then restore it.
  await client.query('savepoint legacy_upload_expiry');
  await client.query('alter table payment_proofs drop column upload_authorized_until');
  await client.query("insert into payment_proofs(id,organization_id,client_proof_id,uploaded_by,content_type,byte_length,sha256,retention_days,retention_until,purged_at) values ($1,$2,$1,$3,'image/jpeg',1,$4,30,now()-interval '1 day',now()-interval '1 day')", [id(61), org, cashier, '2'.repeat(64)]);
  await client.query(readFileSync(new URL('../../supabase/migrations/20261004000200_proof_upload_expiry.sql', import.meta.url), 'utf8'));
  assert.equal((await client.query("select count(*)::int as n from payment_proofs where upload_authorized_until=now()+interval '24 hours'")).rows[0].n, 2,
    'Migration must place both active and already-purged legacy manifests on the full 24-hour cutover hold');
  await client.query('rollback to savepoint legacy_upload_expiry');
  await client.query('release savepoint legacy_upload_expiry');
  await client.query('insert into account_deletions(subject_hash,user_id) values ($1,$2)', [createHash('sha256').update(cashier).digest('hex'), cashier]);
  await rejectsSql("insert into profiles(user_id,display_name) values ($1,'Synthetic re-entry')", [cashier], '42501');
  await rejectsSql("insert into payment_records(organization_id,created_by,client_record_id,capture_origin,amount_centavos,captured_at) values ($1,$2,$3,'CAMERA',10000,now())", [org, cashier, id(43)], '42501');
  await client.query('delete from auth.users where id=$1', [cashier]);
  assert.equal((await client.query('select created_by from payment_records where id=$1', [id(41)])).rows[0].created_by, null, 'Auth deletion must preserve business records');
  assert.equal((await client.query('select uploaded_by from payment_proofs where id=$1', [id(60)])).rows[0].uploaded_by, null, 'Auth deletion must preserve required proof metadata');
  assert.equal(await count('account_deletions'), 1, 'Tombstone must survive Auth deletion to reject old JWT subjects');
  console.log('Database invariants passed: workspace/cashier RLS, restricted columns, idempotency, matching scope, late queue revisions/leases, deletion tombstone and retained records.');
} finally {
  await client.query('rollback');
  await client.end();
}

await import('./proof-retention-invariants.mjs');
