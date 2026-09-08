// Quick sanity check of the live database: applied migrations, public tables, storage buckets.
// Usage: node supabase/check-db.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'apps', 'api', 'package.json'));
const { Client } = require('pg');

const envFile = readFileSync(join(here, '..', '.env'), 'utf8');
const url = process.env.DATABASE_URL ?? envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const migrations = await client.query('select version, name from supabase_migrations.schema_migrations order by version');
const tables = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
const buckets = await client.query('select id, public, file_size_limit from storage.buckets order by 1');
const rls = await client.query("select count(*)::int as n from pg_policies where schemaname = 'public'");
console.log('migrations:', migrations.rows.map((r) => `${r.version}_${r.name}`).join(', '));
console.log('public tables:', tables.rows.length, tables.rows.map((r) => r.table_name).join(', '));
console.log('buckets:', buckets.rows);
console.log('RLS policies on public:', rls.rows[0].n);
await client.end();
