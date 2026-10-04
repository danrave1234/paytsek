import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_VERSION_HEADER, WORKSPACE_HEADER, IDEMPOTENCY_HEADER } from '@paytsek/contracts';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/errors';
import { loadEnv } from './config/env';
import { reportOperationalError } from './common/monitoring';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  // Retain raw request bytes for HMAC-verified billing and evidence webhooks.
  // JSON is still parsed normally for every other route.
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'], rawBody: true });
  app.useGlobalFilters(new ApiExceptionFilter());
  const origins = env.API_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    allowedHeaders: ['Authorization', 'Content-Type', API_VERSION_HEADER, WORKSPACE_HEADER, IDEMPOTENCY_HEADER],
  });
  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
  new Logger('Bootstrap').log(`PayTsek API listening on ${env.API_PUBLIC_URL} (port ${env.API_PORT})`);
}

bootstrap().catch(async () => {
  // eslint-disable-next-line no-console
  console.error('BOOTSTRAP_FAILED');
  await reportOperationalError('BOOTSTRAP_FAILED');
  process.exit(1);
});
