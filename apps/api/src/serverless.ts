import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { API_VERSION_HEADER, IDEMPOTENCY_HEADER, WORKSPACE_HEADER } from '@paytsek/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/errors';
import { loadEnv } from './config/env';

let cached: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const originalPath = requestUrl.searchParams.get('paytsek_path');
  if (originalPath?.startsWith('/')) { requestUrl.searchParams.delete('paytsek_path'); const query = requestUrl.searchParams.toString(); req.url = `${originalPath}${query ? `?${query}` : ''}`; }
  cached ??= (async () => {
    const env = loadEnv(); const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'], rawBody: true });
    app.useGlobalFilters(new ApiExceptionFilter());
    const origins = env.API_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
    app.enableCors({ origin: origins.length ? origins : false, allowedHeaders: ['Authorization', 'Content-Type', API_VERSION_HEADER, WORKSPACE_HEADER, IDEMPOTENCY_HEADER] });
    await app.init(); return app.getHttpAdapter().getInstance();
  })().catch((error) => { cached = null; throw error; });
  (await cached)(req, res);
}
