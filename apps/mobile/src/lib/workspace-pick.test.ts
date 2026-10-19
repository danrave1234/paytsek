import { describe, expect, it } from 'vitest';
import type { WorkspaceSummary } from '@paytsek/contracts';
import { pickWorkspace } from './workspace-pick';

const ws = (id: string, role: WorkspaceSummary['role']): WorkspaceSummary => ({
  id, name: 'Synthetic workspace', timezone: 'Asia/Manila', role, isDemo: false, createdAt: '2026-10-04T02:00:00.000Z',
});
const team = ws('00000000-0000-4000-8000-0000000000a1', 'CASHIER');
const own = ws('00000000-0000-4000-8000-0000000000b2', 'OWNER');

describe('automatic workspace entry', () => {
  it('has nothing to enter before the default workspace exists', () => {
    expect(pickWorkspace([])).toBeNull();
  });
  it('keeps the preferred workspace while the account is still a member', () => {
    expect(pickWorkspace([own, team], team.id)).toBe(team.id);
  });
  it('falls back to the account’s own store, then to any membership', () => {
    expect(pickWorkspace([team, own], 'removed-workspace')).toBe(own.id);
    expect(pickWorkspace([team])).toBe(team.id);
  });
});
