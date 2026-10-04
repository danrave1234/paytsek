import { Controller, Get, Headers, Query } from '@nestjs/common';
import { authorizeCron } from './cron-auth';
import { WorkerService } from './worker.service';
import { BillingService } from '../billing/billing.service';

/**
 * Serverless entrypoint for the background worker.
 *
 * On a long-running host the worker is its own process (`pnpm api:worker`,
 * WorkerService.runForever). Serverless functions cannot hold that loop, so
 * Vercel Cron calls these routes on a schedule and each invocation does one
 * bounded pass instead.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on
 * the project. If the secret is unset here, every request is refused: an
 * unauthenticated endpoint that executes queued jobs is not something to leave
 * open by accident, so the failure mode is "cron stops" rather than "anyone can
 * drain the queue".
 */
@Controller('v1/internal/cron')
export class CronController {
  constructor(private readonly worker: WorkerService, private readonly billing: BillingService) {}

  /** Process queued jobs. Scheduled every minute. */
  @Get('drain')
  async drain(
    @Headers('authorization') authorization: string | undefined,
    @Query('maxJobs') maxJobs?: string,
  ): Promise<{ processed: number; timedOut: boolean }> {
    authorizeCron(authorization);
    const parsed = maxJobs ? Number.parseInt(maxJobs, 10) : undefined;
    return this.worker.drain(Number.isFinite(parsed) ? { maxJobs: parsed } : {});
  }

  /** Enqueue retention purge, then drain the queue. Scheduled daily on Vercel. */
  @Get('maintenance')
  async maintenance(@Headers('authorization') authorization: string | undefined): Promise<{ ok: true }> {
    authorizeCron(authorization);
    await this.billing.expireEndedAccess();
    await this.worker.enqueueMaintenance();
    // Reconciliation runs inline at record-create/ingest time; this drain is
    // the safety net that retries anything the inline pass could not finish.
    await this.worker.drain({});
    return { ok: true };
  }
}
