// Applies supabase/migrations/*.sql in order against DATABASE_URL without the Supabase CLI.
// Records applied versions in supabase_migrations.schema_migrations (CLI-compatible) so
// `supabase db push` can take over later. Usage: node supabase/apply-migrations.mjs
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'apps', 'api', 'package.json'));
const { Client } = require('pg');

const envFile = readFileSync(join(here, '..', '.env'), 'utf8');
const url = process.env.DATABASE_URL ?? envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error('DATABASE_URL not set');

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('create schema if not exists supabase_migrations');
await client.query(`create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text)`);
const applied = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version));

const dir = join(here, 'migrations');
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
  if (applied.has(version)) { console.log('skip ', file); continue; }
  const sql = readFileSync(join(dir, file), 'utf8');
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [version, rest.join('_'), [sql]]);
    await client.query('commit');
    console.log('apply', file);
  } catch (e) {
    await client.query('rollback');
    console.error('FAILED', file, '\n', e.message);
    process.exitCode = 1;
    break;
  }
}
await client.end();
