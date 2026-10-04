/** Immutable identity for asynchronous work. Tokens never leave SecureStore. */
export type RequestScope = Readonly<{ userId: string; workspaceId: string | null; generation: number }>;

let current: RequestScope | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export class ScopeChangedError extends Error {
  constructor() { super('Your account or workspace changed. Open this record in its original workspace to continue.'); }
}

export function setRequestScope(userId: string | null, workspaceId: string | null = null): void {
  if (current?.userId === userId && current.workspaceId === workspaceId) return;
  generation += 1;
  current = userId ? Object.freeze({ userId, workspaceId, generation }) : null;
  for (const listener of listeners) listener();
}

export function getRequestScope(): RequestScope | null { return current; }
export function isScopeCurrent(scope: RequestScope): boolean {
  return current?.generation === scope.generation && current.userId === scope.userId && current.workspaceId === scope.workspaceId;
}
export function requireRequestScope(): RequestScope {
  if (!current) throw new ScopeChangedError();
  return current;
}
export function assertScopeCurrent(scope: RequestScope): void {
  if (!isScopeCurrent(scope)) throw new ScopeChangedError();
}
export function onScopeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
