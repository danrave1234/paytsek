// Actual service SQL/transactions against disposable localhost only. Synthetic
// fixtures commit so independent connections can race; finally removes them.
// Storage is a deterministic capability/removal double, never a remote bucket.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';

const url = process.env.DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('Proof retention invariants require a disposable local database');
}
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const compiled = (path) => require(fileURLToPath(new URL(`../../apps/api/dist/${path}.js`, import.meta.url)));
const { loadEnv, resetEnvCache } = compiled('config/env');
resetEnvCache();
loadEnv({ DATABASE_URL: url, SUPABASE_URL: 'http://127.0.0.1:55321',
  SUPABASE_ANON_KEY: 'synthetic-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  COLLECTOR_TOKEN_HASH_SECRET: 'synthetic-test-secret-32-characters', BETA_MODE: 'true' });
const { DbService } = compiled('db/db.service');
const { ProofsService } = compiled('records/proofs.service');
const { RetentionService } = compiled('jobs/retention.service');
const { ReadinessService } = compiled('operations/readiness.controller');
const { JobsService } = compiled('jobs/jobs.service');
const db = new DbService();
const owner = randomUUID(), orgs = [randomUUID(), randomUUID(), randomUUID()];
const jobKey = `synthetic-expiry-${randomUUID()}`;
const removed = [];
let signed = 0;
const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
const signingStarted = Promise.withResolvers(), releaseSigning = Promise.withResolvers();
const storage = {
  proofsBucket: 'synthetic-proofs', exportsBucket: 'synthetic-exports',
  proofPath: (org, proof) => `${org}/${proof}.jpg`,
  createSignedUpload: async () => {
    signed += 1;
    signingStarted.resolve();
    await releaseSigning.promise;
    return { url: 'https://storage.example.invalid/synthetic-capability', expiresAt: expiry };
  },
  remove: async (bucket, paths) => { removed.push({ bucket, paths }); },
  privateBucketsReady: async () => true,
};
const input = () => ({ clientProofId: randomUUID(), sha256: randomUUID().replaceAll('-', '').repeat(2), contentType: 'image/jpeg', byteLength: 1 });
const proofs = new ProofsService(db, storage), retention = new RetentionService(db, storage);
const pending = [];
let blocker;
async function waitForLock(pid) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const row = await db.one('select cardinality(pg_blocking_pids($1))>0 as blocked', [pid]);
    if (row.blocked) return;
    await pause(20);
  }
  assert.fail('Expected database row-lock contention was not observed');
}
const track = (promise) => { pending.push(promise); promise.catch(() => {}); return promise; };
try {
  await db.query("insert into auth.users(id,email) values ($1,'expiry-fixture@example.invalid')", [owner]);
  for (const org of orgs) {
    await db.query("insert into organizations(id,name,created_by) values ($1,'Synthetic expiry',$2)", [org, owner]);
    await db.query("insert into memberships(organization_id,user_id,role) values ($1,$2,'OWNER')", [org, owner]);
  }

  // Issuance owns the organization lock until its true expiry is committed.
  const issued = track(proofs.init(orgs[0], owner, input()));
  await Promise.race([signingStarted.promise, issued.then(() => assert.fail('Expected signing barrier'))]);
  blocker = await db.pool.connect();
  const deletion = track(blocker.query('update organizations set deleted_at=now() where id=$1', [orgs[0]]));
  await waitForLock(blocker.processID);
  releaseSigning.resolve();
  const proof = await issued;
  await deletion;
  blocker.release(); blocker = undefined;
  const persisted = await db.one('select upload_authorized_until from payment_proofs where id=$1', [proof.proofId]);
  assert.equal(persisted.upload_authorized_until.toISOString(), expiry.toISOString(), 'Capability expiry must persist before response');
  assert.equal(proof.expiresAt, expiry.toISOString());

  // Replayed legacy uploads include proofs previously marked purged. Both
  // manifests must survive until every upload capability and grace period end.
  const legacy = randomUUID(), legacyPath = `${orgs[0]}/${legacy}.jpg`;
  await db.query(`insert into payment_proofs(id,organization_id,client_proof_id,uploaded_by,content_type,byte_length,sha256,
    retention_days,retention_until,storage_path,purged_at,upload_authorized_until)
    values ($1,$2,$1,$3,'image/jpeg',1,$4,30,now()-interval '1 day',$5,now()-interval '2 days',$6)`,
  [legacy, orgs[0], owner, 'a'.repeat(64), legacyPath, expiry]);
  let progress = await retention.run(orgs[0], true);
  assert.equal(removed.length, 0, 'Unexpired upload capabilities forbid Storage removal');
  assert.equal(progress.more, true);
  assert.ok(progress.runAfterSeconds > 7_000, 'Deferred cleanup must avoid busy retries');
  assert.ok(await db.one('select id from organizations where id=$1', [orgs[0]]), 'Do not cascade away the cleanup manifest');
  await db.query("update payment_proofs set upload_authorized_until=now()-interval '10 minutes' where organization_id=$1", [orgs[0]]);
  progress = await retention.run(orgs[0], true);
  assert.equal(removed.length, 0, 'Expiry alone is insufficient: retain the 15-minute in-flight upload grace');
  assert.equal(progress.more, true);
  await db.query("update payment_proofs set upload_authorized_until=now()-interval '16 minutes' where organization_id=$1", [orgs[0]]);
  assert.deepEqual(await retention.run(orgs[0], true), { more: false, runAfterSeconds: 1 });
  assert.deepEqual(new Set(removed.flatMap((call) => call.paths)), new Set([`${orgs[0]}/${proof.proofId}.jpg`, legacyPath]));
  assert.equal(await db.one('select id from organizations where id=$1', [orgs[0]]), null);

  // If removal wins first, a request already authenticated before the lock
  // wait must re-check both workspace and membership under READ COMMITTED.
  for (const [index, mutation] of [[1, 'workspace'], [2, 'membership']]) {
    blocker = await db.pool.connect();
    await blocker.query('begin');
    await blocker.query('select id from organizations where id=$1 for update', [orgs[index]]);
    if (mutation === 'workspace') await blocker.query('update organizations set deleted_at=now() where id=$1', [orgs[index]]);
    else await blocker.query('delete from memberships where organization_id=$1 and user_id=$2', [orgs[index], owner]);
    const began = Promise.withResolvers();
    const observed = { tx: (fn) => db.tx((tx) => { began.resolve(tx.processID); return fn(tx); }) };
    const attempt = track(new ProofsService(observed, storage).init(orgs[index], owner, input()));
    await waitForLock(await began.promise);
    await blocker.query('commit');
    blocker.release(); blocker = undefined;
    await assert.rejects(attempt, (error) => error.code === 'NOT_A_MEMBER');
    assert.equal(signed, 1, `${mutation} removal must prevent additional upload capabilities`);
    assert.equal((await db.one('select count(*)::int as n from payment_proofs where organization_id=$1', [orgs[index]])).n, 0);
  }

  const jobs = new JobsService(db), readiness = new ReadinessService(db, storage);
  await jobs.enqueue('PURGE_RETENTION', {}, jobKey, undefined, 7_200);
  await db.query("update jobs set created_at=now()-interval '2 days' where dedupe_key=$1", [jobKey]);
  let health = await readiness.inspect();
  assert.equal(health.checks.schema, true, 'Readiness must see upload-expiry migration and column');
  assert.equal(health.operationalStatus, 'HEALTHY', 'Old but deliberately future-scheduled work is not stale');
  await jobs.enqueue('PURGE_RETENTION', { fresh: true }, jobKey);
  const expedited = await db.one('select run_after<=now() as due, revision from jobs where dedupe_key=$1', [jobKey]);
  assert.equal(expedited.due, true, 'Fresh work expedites the coalesced future job');
  assert.equal(expedited.revision, 2);
  await db.query("update jobs set run_after=now()-interval '16 minutes' where dedupe_key=$1", [jobKey]);
  health = await readiness.inspect();
  assert.equal(health.operationalStatus, 'DEGRADED', 'Actually overdue work still alerts');
  assert.equal(health.ok, true, 'Queue degradation must not block repair deployment');
  console.log('Proof retention invariants passed: real issuance/deletion locks, membership recheck, durable expiry, grace/legacy re-sweep, retained manifest, deferred queue readiness and expedited fresh work.');
} finally {
  releaseSigning.resolve();
  if (blocker) { await blocker.query('rollback').catch(() => {}); blocker.release(); }
  await Promise.allSettled(pending);
  await db.query('delete from jobs where dedupe_key=$1', [jobKey]);
  await db.query('delete from organizations where id=any($1::uuid[])', [orgs]);
  await db.query('delete from auth.users where id=$1', [owner]);
  await db.onModuleDestroy();
}
