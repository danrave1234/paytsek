// Transactional, pooler-safe migrations. Importing this file never connects to a database.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'apps', 'api', 'package.json'));
const { Client } = require('pg');

// Transaction locks work with Supabase's transaction pooler; session advisory locks do not.
const lockSql = 'select pg_advisory_xact_lock(706179, 747365)';

export function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n').trim()).digest('hex');
}

export function connectionOptions(value, env = process.env) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected a PostgreSQL URL');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const mode = url.searchParams.get('sslmode');
  if (!local && mode === 'disable') throw new Error('Remote migrations require verified TLS');
  // pg URL SSL flags override an explicit ssl object. Always apply our policy.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  const ca = env.DATABASE_SSL_CA || (env.DATABASE_SSL_CA_FILE ? readFileSync(env.DATABASE_SSL_CA_FILE, 'utf8') : undefined);
  return {
    connectionString: url.toString(),
    ssl: local && (!mode || mode === 'disable') ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000,
    lock_timeout: 30_000,
    application_name: 'paytsek-migrations',
  };
}

export async function applyMigrations(env = process.env) {
  const envPath = join(here, '..', '.env');
  const localEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
  const url = env.DATABASE_URL ?? localEnv.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client(connectionOptions(url, env));
  await client.connect();
  try {
    await client.query('begin');
    await client.query(lockSql);
    await client.query('create schema if not exists supabase_migrations');
    await client.query(`create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text)`);
    await client.query(`create table if not exists supabase_migrations.paytsek_checksums (
      version text primary key references supabase_migrations.schema_migrations(version) on delete cascade,
      sha256 text not null check (length(sha256) = 64), verified_at timestamptz not null default now())`);
    await client.query('commit');

    const dir = join(here, 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const versions = new Set();
    for (const file of files) {
      if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) throw new Error(`Invalid migration filename: ${file}`);
      const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
      if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
      versions.add(version);
      const sql = readFileSync(join(dir, file), 'utf8');
      const hash = checksum(sql);
      await client.query('begin');
      try {
        await client.query(lockSql);
        const found = await client.query(`select m.statements, c.sha256 from supabase_migrations.schema_migrations m
          left join supabase_migrations.paytsek_checksums c using (version) where m.version = $1`, [version]);
        const applied = found.rows[0];
        if (applied) {
          if (applied.sha256 && applied.sha256 !== hash) throw new Error(`Applied migration changed: ${file}`);
          if (!applied.sha256) {
            if (applied.statements?.length === 1) {
              if (checksum(applied.statements[0]) !== hash) throw new Error(`Legacy migration differs from checked-in SQL: ${file}`);
            } else if (env.MIGRATION_ACCEPT_LEGACY_BASELINE !== 'true') {
              throw new Error(`Verify legacy SQL for ${file}, then explicitly set MIGRATION_ACCEPT_LEGACY_BASELINE=true once`);
            }
            await client.query('insert into supabase_migrations.paytsek_checksums(version, sha256) values ($1,$2)', [version, hash]);
          }
          await client.query('commit');
          console.log('verified', file);
          continue;
        }
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations(version, name, statements) values ($1,$2,$3)', [version, rest.join('_'), [sql]]);
        await client.query('insert into supabase_migrations.paytsek_checksums(version, sha256) values ($1,$2)', [version, hash]);
        await client.query('commit');
        console.log('applied', file);
      } catch (error) {
        await client.query('rollback');
        // SQL errors may include row contents; print only migration name and SQLSTATE.
        if (error.code) throw new Error(`Migration ${file} failed (SQLSTATE ${error.code})`);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyMigrations().catch((error) => { console.error(error.code ? `Migration connection failed (${error.code})` : error.message); process.exitCode = 1; });
}
