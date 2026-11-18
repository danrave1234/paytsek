import { describe, expect, it, vi } from 'vitest';
import type { ListRecordsQuery } from '@paytsek/contracts';
import type { DbService } from '../db/db.service';
import type { AuditService } from '../db/audit.service';
import type { ReconcileService } from '../matching/reconcile.service';
import type { ProofsService } from './proofs.service';
import { RecordsService } from './records.service';

vi.mock('../config/env', () => ({ loadEnv: () => ({ BETA_MODE: true }) }));

async function search(q: string, isOwner = true, filters: Partial<ListRecordsQuery> = {}) {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const service = new RecordsService({ query } as unknown as DbService, {} as AuditService, {} as ReconcileService, {} as ProofsService);
  await service.list('synthetic-workspace', 'synthetic-cashier', isOwner, { q, limit: 30, ...filters });
  const [sql, params] = query.mock.calls[0]! as [string, unknown[]];
  return { sql, params };
}

describe('record search consistency', () => {
  it.each(['1250', '1,250', '₱1,250.00', 'PHP 1,250.00', 'P1250', ' 1250.00 '])('uses exact integer centavos for %s', async (q) => {
    const { sql, params } = await search(q);
    expect(sql).toContain('r.amount_centavos = $3');
    expect(params).toEqual(['synthetic-workspace', q.trim().toLowerCase(), 125000, 31]);
  });

  it.each(['12.345', '1,2,5', '1e2', '0x64', '+100', 'P1H0P0', '100 00'])('does not round or reinterpret %s', async (q) => {
    const { sql, params } = await search(q);
    expect(sql).not.toMatch(/r\.amount_centavos = \$\d+/);
    expect(params).toEqual(['synthetic-workspace', q.toLowerCase(), 31]);
  });

  it.each(['%', '_', '\\', 'GCash', 'Unknown wallet'])('searches %s as literal visible label text', async (q) => {
    const { sql, params } = await search(q);
    expect(sql).toContain('strpos(lower(case r.receipt_provider');
    expect(sql).toContain("else 'Unknown wallet'");
    expect(sql).not.toContain(' ilike ');
    expect(params[1]).toBe(q.toLowerCase());
  });

  it('preserves workspace, cashier, provider, and evidence restrictions during search', async () => {
    const { sql, params } = await search('100', false, { provider: 'MAYA', state: ['UNVERIFIED'], staffUserId: 'another-staff' });
    expect(sql).toContain('r.organization_id = $1');
    expect(sql).toContain('r.evidence_state = any($4::evidence_state[])');
    expect(sql).toContain('r.receipt_provider = $5::provider');
    expect(sql).toContain('r.created_by = $6');
    expect(params).toEqual(['synthetic-workspace', '100', 10000, ['UNVERIFIED'], 'MAYA', 'synthetic-cashier', 31]);
    expect(params).not.toContain('another-staff');
  });
});
