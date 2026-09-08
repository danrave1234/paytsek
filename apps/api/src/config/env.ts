import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number.parseInt(v, 10)))
    .pipe(z.number().int().nonnegative());

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: int(3000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  API_CORS_ORIGINS: z.string().optional().default(''),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  /** Server only. Never sent to clients. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  /** Legacy HS256 secret; optional when the project uses asymmetric signing keys (JWKS). */
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  DATABASE_URL: z.string().min(10),
  DATABASE_POOL_MAX: int(10),

  STORAGE_BUCKET_PROOFS: z.string().default('proof-images'),
  STORAGE_BUCKET_EXPORTS: z.string().default('exports'),
  STORAGE_SIGNED_UPLOAD_TTL_SECONDS: int(300),
  STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS: int(120),

  COLLECTOR_TOKEN_HASH_SECRET: z.string().min(32),
  PAIRING_CODE_TTL_SECONDS: int(300),
  PAIRING_MAX_ATTEMPTS_PER_15MIN: int(10),

  MATCH_CANDIDATE_WINDOW_SECONDS: int(300),
  MATCH_CAPTURE_TIME_FALLBACK_WINDOW_SECONDS: int(900),
  WORKER_POLL_INTERVAL_MS: int(2000),
  WORKER_LEASE_SECONDS: int(60),
  WORKER_MAX_ATTEMPTS: int(8),

  REVENUECAT_SECRET_API_KEY: z.string().optional().default(''),
  REVENUECAT_WEBHOOK_AUTH_HEADER: z.string().optional().default(''),
  BILLING_PRODUCT_SOLO_MONTHLY: z.string().default('payrecord_solo_monthly'),
  BILLING_PRODUCT_TEAM_MONTHLY: z.string().default('payrecord_team_monthly'),
  BILLING_PRODUCT_PACK_500: z.string().default('payrecord_pack_500'),

  RETENTION_UNLINKED_EVENTS_DAYS: int(7),
  RETENTION_PROOF_IMAGE_FREE_DAYS: int(30),
  RETENTION_PROOF_IMAGE_PAID_DAYS: int(90),
  RETENTION_RECORDS_MONTHS: int(12),
  RETENTION_EXPORT_HOURS: int(24),

  SENTRY_DSN: z.string().optional().default(''),
  DEMO_MODE_ENABLED: bool,
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}\nSee .env.example for required deployment inputs.`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper. */
export function resetEnvCache(): void {
  cached = null;
}

export const ENV = Symbol('ENV');
