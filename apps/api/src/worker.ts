import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { WorkerService } from './jobs/worker.service';

/** Background worker process: `pnpm api:worker`. Safe to run multiple replicas. */
async function main(): Promise<void> {
  loadEnv();
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const worker = ctx.get(WorkerService);
  const shutdown = async () => {
    worker.stop();
    await ctx.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await worker.runForever();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
