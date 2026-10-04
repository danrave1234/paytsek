import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (project.projectId !== process.env.VERCEL_PROJECT_ID || project.orgId !== process.env.VERCEL_ORG_ID || project.projectName !== 'paytsek-api') {
  throw new Error('Root deployment must be linked to the expected paytsek-api project and team');
}
const config = parseEnv(readFileSync('.vercel/.env.production.local', 'utf8'));
if (!process.env.CRON_SECRET && !config.CRON_SECRET) throw new Error('Configure matching CRON_SECRET in Vercel and the production-api GitHub environment');
// Vercel cannot return sensitive values on pull; empty exports do not override server defaults.
if (!['true', '1', '', undefined].includes(config.BETA_MODE)) throw new Error('Production beta must keep BETA_MODE enabled');
console.log('Verified paytsek-api project, readiness secret presence, and beta mode.');
