import { describe, expect, it } from 'vitest';
import { CreateExportRequest, HomeQuery } from './schemas/workspace';

describe('operational boundaries', () => {
  const request = { format: 'CSV', from: '2026-10-01T00:00:00Z', to: '2026-10-04T00:00:00Z' };
  it('allows only truthfully generated CSV exports', () => {
    expect(CreateExportRequest.safeParse(request).success).toBe(true);
    expect(CreateExportRequest.safeParse({ ...request, format: 'XLSX' }).success).toBe(false);
  });
  it('rejects backwards and unbounded export ranges', () => {
    expect(CreateExportRequest.safeParse({ ...request, to: request.from }).success).toBe(false);
    expect(CreateExportRequest.safeParse({ ...request, to: '2030-10-04T00:00:00Z' }).success).toBe(false);
  });
  it('bounds the pending proof acknowledgment request and validates every ID', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(HomeQuery.parse({ pendingIds: id }).pendingIds).toEqual([id]);
    expect(HomeQuery.safeParse({ pendingIds: 'invalid' }).success).toBe(false);
    expect(HomeQuery.safeParse({ pendingIds: Array(101).fill(id).join(',') }).success).toBe(false);
  });
});
