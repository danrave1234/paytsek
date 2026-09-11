import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { API_VERSION_HEADER, IDEMPOTENCY_HEADER, WORKSPACE_HEADER } from '@paytsek/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/errors';
import { loadEnv } from '../src/config/env';

/**
 * Vercel serverless entrypoint.
 *
 * `src/main.ts` stays the entrypoint for local development and for any
 * long-running host: it calls `app.listen()`, which serverless cannot do.
 * Here Nest is bootstrapped once per warm instance and its underlying Express
 * handler is returned, so subsequent requests on the same instance skip the
 * whole DI graph.
 *
 * The promise (not the resolved app) is cached, so concurrent cold-start
 * requests share a single bootstrap instead of each building their own Nest
 * container and Postgres pool.
 */
let cached: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

async function bootstrap(): Promise<(req: IncomingMessage, res: ServerResponse) => void> {
  const env = loadEnv();
  // PayMongo signatures are calculated over unmodified bytes. Keep rawBody
  // available to that one route while retaining normal JSON parsing elsewhere.
  const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'], rawBody: true });
  app.useGlobalFilters(new ApiExceptionFilter());

  const origins = env.API_CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : false,
    allowedHeaders: ['Authorization', 'Content-Type', API_VERSION_HEADER, WORKSPACE_HEADER, IDEMPOTENCY_HEADER],
  });

  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Vercel functions live below /api. The public API deliberately lives at
  // /v1, so the rewrite carries the original route in a query parameter.
  // Restore it before Express/Nest sees the request; retaining regular query
  // parameters keeps record filtering and pagination intact.
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const originalPath = requestUrl.searchParams.get('paytsek_path');
  if (originalPath?.startsWith('/')) {
    requestUrl.searchParams.delete('paytsek_path');
    const remainingQuery = requestUrl.searchParams.toString();
    req.url = `${originalPath}${remainingQuery ? `?${remainingQuery}` : ''}`;
  }
  cached ??= bootstrap().catch((e) => {
    // Do not cache a failed bootstrap: a transient failure (e.g. the database
    // being briefly unreachable) would otherwise poison this instance for its
    // whole lifetime.
    cached = null;
    throw e;
  });
  const express = await cached;
  express(req, res);
}
