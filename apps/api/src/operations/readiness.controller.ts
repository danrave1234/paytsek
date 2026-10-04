import { Controller, Get, Headers, HttpException, Injectable, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { authorizeCron } from '../jobs/cron-auth';
import { JobsService } from '../jobs/jobs.service';
import { loadEnv } from '../config/env';

type QueueHealth = { pending: number; dead: number; oldestAgeSeconds: number; failedDeletions: number };

@Injectable()
export class ReadinessService {
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  async inspect() {
    const checks = { database: false, schema: false, storage: false, queue: false };
    let queue: QueueHealth | null = null;
    const databaseCheck = async () => {
      const schema = await this.db.one<{ ready: boolean }>(`select exists (
        select 1 from supabase_migrations.schema_migrations where version='20261004000100')
        and to_regclass('public.account_deletions') is not null
        and to_regclass('public.maintenance_reports') is not null as ready`);
      checks.database = true;
      checks.schema = schema?.ready === true;
      if (!checks.schema) return;
      const health = await this.db.one<QueueHealth>(`select
        count(*) filter(where status in ('PENDING','LEASED'))::int as pending,
        count(*) filter(where status='DEAD')::int as dead,
        coalesce(extract(epoch from now()-min(created_at) filter(where status in ('PENDING','LEASED'))),0)::int as "oldestAgeSeconds",
        (select count(*)::int from account_deletions where status='FAILED') as "failedDeletions" from jobs`);
      queue = health;
      checks.queue = !!health && health.dead === 0 && health.failedDeletions === 0 && health.oldestAgeSeconds < 900;
    };
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled([databaseCheck(), this.storage.privateBucketsReady().then((ready) => { checks.storage = ready; })]),
        new Promise((resolve) => { timer = setTimeout(resolve, 5_000); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
    // Copy mutable state; timed-out work must not change the returned snapshot.
    return {
      ok: checks.database && checks.schema && checks.storage,
      operationalStatus: checks.queue ? 'HEALTHY' : 'DEGRADED',
      buildSha: process.env.PAYTSEK_BUILD_SHA ?? null,
      betaModeEnabled: loadEnv().BETA_MODE,
      checks: { ...checks }, queue,
    };
  }
}

@Controller('v1/internal')
export class ReadinessController {
  constructor(private readonly readiness: ReadinessService, private readonly db: DbService, private readonly jobs: JobsService) {}

  @Get('ready')
  async ready(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    authorizeCron(authorization);
    const result = await this.readiness.inspect();
    if (!result.ok) response.status(503);
    return result;
  }

  @Get('retention-report')
  async retention(@Headers('authorization') authorization: string | undefined) {
    authorizeCron(authorization);
    return this.db.one(`select checked_at,details from maintenance_reports where name='record-retention'`);
  }

  @Get('account-deletions/:id')
  async deletionStatus(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    authorizeCron(authorization);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpException('Invalid request ID', 400);
    return this.db.one(`select id,status,requested_at,completed_at,last_error_code,attempts from account_deletions where id=$1`, [id]);
  }

  @Post('account-deletions/:id/retry')
  async retryDeletion(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    authorizeCron(authorization);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpException('Invalid request ID', 400);
    await this.db.tx(async (tx) => {
      const row = await tx.query(`update account_deletions set status='PENDING',last_error_code=null where id=$1 and status='FAILED' returning id`, [id]);
      if (row.rowCount) {
        await tx.query(`update jobs set status='DONE',finished_at=now() where kind='DELETE_ACCOUNT' and status='DEAD' and payload->>'requestId'=$1`, [id]);
        await this.jobs.enqueue('DELETE_ACCOUNT', { requestId: id }, `delete-account:${id}`, tx);
      }
    });
    return { ok: true };
  }
}
