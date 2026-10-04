import { ForbiddenException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env';

export function authorizeCron(header: string | undefined): void {
  const secret = loadEnv().CRON_SECRET;
  if (!secret) throw new ForbiddenException('Internal authorization unavailable');
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(hash(`Bearer ${secret}`), hash(header ?? ''))) throw new ForbiddenException('Invalid internal authorization');
}
