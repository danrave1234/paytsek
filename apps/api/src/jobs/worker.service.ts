import { Injectable, Logger } from '@nestjs/common';
import { EVIDENCE_STATE_LABELS, type EvidenceState } from '@paytsek/contracts';
import { formatCentavos } from '@paytsek/receipt-parsers';
import { hostname } from 'node:os';
import { BillingService } from '../billing/billing.service';
import { loadEnv } from '../config/env';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { ReconcileService } from '../matching/reconcile.service';
import { JobsService, type JobRow } from './jobs.service';

/**
 * Postgres-backed worker: leases jobs with SKIP LOCKED, runs them with bounded
 * retries, and schedules periodic retention maintenance. No Redis, no cron
 * daemon: run `pnpm api:worker` as a separate process (1..N replicas).
 */
@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private readonly env = loadEnv();
  private readonly workerId = `${hostname()}:${process.pid}`;
  private stopping = false;

  constructor(
    private readonly db: DbService,
    private readonly jobs: JobsService,
    private readonly reconcile: ReconcileService,
    private readonly storage: StorageService,
    private readonly billing: BillingService,
  ) {}

  async runForever(): Promise<void> {
    this.logger.log(`worker ${this.workerId} started`);
    let lastMaintenance = 0;
    while (!this.stopping) {
      try {
        if (Date.now() - lastMaintenance > 60 * 60 * 1000) {
          await this.jobs.enqueue('PURGE_RETENTION', {}, 'purge:periodic');
          lastMaintenance = Date.now();
        }
        const leased = await this.jobs.lease(this.workerId, 10, this.env.WORKER_LEASE_SECONDS);
        if (leased.length === 0) {
          await sleep(this.env.WORKER_POLL_INTERVAL_MS);
          continue;
        }
        for (const job of leased) await this.runOne(job);
      } catch (e) {
        this.logger.error(`worker loop error: ${(e as Error).message}`);
        await sleep(this.env.WORKER_POLL_INTERVAL_MS);
      }
    }
  }

  stop(): void {
    this.stopping = true;
  }

  /**
   * One bounded pass over the queue, for a serverless cron invocation where
   * `runForever` cannot be used. Stops on whichever comes first: no work left,
   * `maxJobs`, or `budgetMs`. The budget defaults below Vercel's free-tier
   * 10s function limit so the invocation returns rather than being killed
   * mid-job -- a killed invocation would leave the lease held until it expires.
   */
  async drain({ maxJobs = 25, budgetMs = 8_000 }: { maxJobs?: number; budgetMs?: number } = {}): Promise<{
    processed: number;
    timedOut: boolean;
  }> {
    const startedAt = Date.now();
    let processed = 0;

    while (processed < maxJobs) {
      const remaining = budgetMs - (Date.now() - startedAt);
      if (remaining <= 0) return { processed, timedOut: true };

      const leased = await this.jobs.lease(this.workerId, Math.min(10, maxJobs - processed), this.env.WORKER_LEASE_SECONDS);
      if (leased.length === 0) break;

      for (const job of leased) {
        if (Date.now() - startedAt >= budgetMs) return { processed, timedOut: true };
        await this.runOne(job);
        processed += 1;
      }
    }
    return { processed, timedOut: false };
  }

  /**
   * Periodic maintenance that `runForever` folds into its loop. As a cron
   * entrypoint it needs its own schedule; the dedupe key keeps repeated calls
   * from queueing duplicates.
   */
  async enqueueMaintenance(): Promise<void> {
    await this.jobs.enqueue('PURGE_RETENTION', {}, 'purge:periodic');
  }

  /** Process one job (also usable from tests / one-shot CLI). */
  async runOne(job: JobRow): Promise<void> {
    try {
      switch (job.kind) {
        case 'RECONCILE_RECORD':
          await this.reconcile.reconcileRecord(String(job.payload.recordId));
          break;
        case 'RECONCILE_EVENT':
          await this.reconcile.reconcileEvent(String(job.payload.eventId));
          break;
        case 'GENERATE_EXPORT':
          await this.generateExport(String(job.payload.exportJobId));
          break;
        case 'PURGE_RETENTION':
          await this.purgeRetention(job.payload.orgId ? String(job.payload.orgId) : null, Boolean(job.payload.hardDelete));
          break;
        case 'RECONCILE_ENTITLEMENT':
          // Retire legacy entitlement retry jobs. PayMongo fulfills only from a
          // signed webhook and does not have a polling reconciliation endpoint.
          break;
        default:
          throw new Error(`unknown job kind ${String(job.kind)}`);
      }
      await this.jobs.complete(job.id);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      this.logger.warn(`job ${job.id} (${job.kind}) failed attempt ${job.attempts}: ${msg}`);
      await this.jobs.fail(job, msg);
    }
  }

  // ---- Exports ---------------------------------------------------------------
  private async generateExport(exportJobId: string): Promise<void> {
    const job = await this.db.one<{ organization_id: string; format: 'CSV' | 'XLSX'; params: { from: string; to: string; sourceId?: string; includeVoided: boolean }; status: string }>(
      `select organization_id, format, params, status from export_jobs where id = $1`,
      [exportJobId],
    );
    if (!job || job.status === 'READY' || job.status === 'EXPIRED') return;
    await this.db.query(`update export_jobs set status = 'RUNNING' where id = $1`, [exportJobId]);
    try {
      const params: unknown[] = [job.organization_id, job.params.from, job.params.to];
      let where = `r.organization_id = $1 and r.created_at between $2 and $3`;
      if (job.params.sourceId) { params.push(job.params.sourceId); where += ` and r.source_id = $${params.length}`; }
      if (!job.params.includeVoided) where += ` and r.evidence_state <> 'VOIDED'`;
      const rows = await this.db.query<{
        id: string; created_at: Date; captured_at: Date; source_label: string; amount_centavos: string; evidence_state: EvidenceState; flags: string[];
        reference_namespace: string | null; reference_value: string | null; payer_name: string | null; payee_name: string | null; customer_label: string | null; note: string | null;
        receipt_transaction_at: Date | null; created_by_name: string | null; match_kind: string | null;
      }>(
        `select r.id, r.created_at, r.captured_at, s.label as source_label, r.amount_centavos, r.evidence_state, r.flags, r.reference_namespace, r.reference_value,
                r.payer_name, r.payee_name, r.customer_label, r.note, r.receipt_transaction_at, p.display_name as created_by_name,
                (select kind from payment_matches pm where pm.record_id = r.id and pm.active) as match_kind
           from payment_records r join payment_sources s on s.id = r.source_id left join profiles p on p.user_id = r.created_by
          where ${where} order by r.created_at`,
        params,
      );
      // XLSX is delivered as CSV in the MVP (opens in Excel/Sheets); the format flag is retained for a future writer.
      const header = ['record_id', 'created_at_utc', 'captured_at_utc', 'source', 'amount_php', 'amount_centavos', 'evidence_state', 'evidence_label', 'match_kind', 'flags', 'reference_namespace', 'reference_value', 'payer_name', 'payee_name', 'customer_label', 'note', 'receipt_transaction_at_utc', 'recorded_by'];
      const lines = [header.join(',')];
      for (const r of rows.rows) {
        lines.push(
          [
            r.id, r.created_at.toISOString(), r.captured_at.toISOString(), r.source_label, formatCentavos(Number(r.amount_centavos)).replace('₱', ''), r.amount_centavos,
            r.evidence_state, EVIDENCE_STATE_LABELS[r.evidence_state], r.match_kind ?? '', (r.flags ?? []).join('|'), r.reference_namespace ?? '', r.reference_value ?? '',
            r.payer_name ?? '', r.payee_name ?? '', r.customer_label ?? '', r.note ?? '', r.receipt_transaction_at?.toISOString() ?? '', r.created_by_name ?? '',
          ].map(csvEscape).join(','),
        );
      }
      const disclaimer = `# PayTsek export. "Notification matched" means matched to an incoming notification on the seller's phone; not confirmed directly with the payment provider. Totals are recorded payments, not wallet balance.`;
      const body = `${disclaimer}\n${lines.join('\n')}\n`;
      const path = `${job.organization_id}/${exportJobId}.csv`;
      await this.storage.upload(this.storage.exportsBucket, path, body, 'text/csv');
      const expires = new Date(Date.now() + this.env.RETENTION_EXPORT_HOURS * 3600 * 1000);
      await this.db.query(`update export_jobs set status = 'READY', storage_path = $2, row_count = $3, expires_at = $4, finished_at = now() where id = $1`, [exportJobId, path, rows.rowCount ?? 0, expires]);
    } catch (e) {
      await this.db.query(`update export_jobs set status = 'FAILED', error_code = 'EXPORT_GENERATION_FAILED', finished_at = now() where id = $1`, [exportJobId]);
      throw e;
    }
  }

  // ---- Retention -------------------------------------------------------------
  private async purgeRetention(orgId: string | null, hardDelete: boolean): Promise<void> {
    // 1. Unlinked, unsaved events past purge_after.
    await this.db.query(
      `update notification_events e set purged_at = now(), payer_masked_name = null, payer_masked_phone = null, reference_value = null
        where e.purged_at is null and e.purge_after < now() and e.saved_as_record_id is null
          and not exists (select 1 from payment_matches pm where pm.event_id = e.id and pm.active)
          ${orgId ? 'and e.organization_id = $1' : ''}`,
      orgId ? [orgId] : [],
    );
    // 2. Proof images past their retention entitlement (records keep structured data).
    const proofs = await this.db.query<{ id: string; storage_path: string | null }>(
      `select id, storage_path from payment_proofs where purged_at is null and (retention_until < now() ${hardDelete && orgId ? 'or organization_id = $1' : ''}) ${orgId && !hardDelete ? 'and organization_id = $1' : ''} limit 500`,
      orgId ? [orgId] : [],
    );
    if (proofs.rowCount) {
      await this.storage.remove(this.storage.proofsBucket, proofs.rows.map((p) => p.storage_path).filter((p): p is string => !!p));
      await this.db.query(`update payment_proofs set purged_at = now() where id = any($1::uuid[])`, [proofs.rows.map((p) => p.id)]);
    }
    // 3. Expired exports.
    const exp = await this.db.query<{ id: string; storage_path: string | null }>(`select id, storage_path from export_jobs where status = 'READY' and expires_at < now() limit 500`);
    if (exp.rowCount) {
      await this.storage.remove(this.storage.exportsBucket, exp.rows.map((p) => p.storage_path).filter((p): p is string => !!p));
      await this.db.query(`update export_jobs set status = 'EXPIRED', storage_path = null where id = any($1::uuid[])`, [exp.rows.map((p) => p.id)]);
    }
    // 4. Structured records older than the retention policy (default 12 months) for soft-deleted workspaces,
    //    then hard-delete the workspace when requested.
    if (hardDelete && orgId) {
      await this.db.query(`delete from organizations where id = $1 and deleted_at is not null`, [orgId]);
    }
    // 5. Rate-limit table hygiene.
    await this.db.query(`delete from pairing_attempts where attempted_at < now() - interval '1 day'`);
  }
}

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
