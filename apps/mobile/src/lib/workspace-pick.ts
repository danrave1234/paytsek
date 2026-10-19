import type { WorkspaceSummary } from '@paytsek/contracts';

/**
 * PayTsek enters a workspace automatically instead of showing a picker.
 * Keep the preferred one while the account is still a member (the last
 * active one, or a team just joined); otherwise use the account's own store
 * before any team it was invited to. The server orders memberships by
 * creation time, so the choice is stable across launches.
 */
export function pickWorkspace(workspaces: readonly WorkspaceSummary[], preferId?: string | null): string | null {
  if (preferId && workspaces.some((workspace) => workspace.id === preferId)) return preferId;
  return (workspaces.find((workspace) => workspace.role === 'OWNER') ?? workspaces[0])?.id ?? null;
}
