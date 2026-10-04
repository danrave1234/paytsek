import type { Session } from '@supabase/supabase-js';
import type { WorkspaceSummary } from '@paytsek/contracts';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { isConfigured } from './env';
import { supabase } from './supabase';
import { clearWorkspaceCache, readWorkspaceCache, setActiveWorkspaceId, writeWorkspaceCache } from './workspace';
import { queryClient } from './queries';
import { getRequestScope, isScopeCurrent, setRequestScope } from './request-scope';
import { signOutConfirmed } from './sign-out';

interface SessionState {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  workspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const configured = isConfigured();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const initializingUser = useRef<string | null | undefined>(undefined);
  const signingOut = useRef<Promise<void> | null>(null);
  const signedOutRevision = useRef(0);

  const refreshWorkspaces = useCallback(async () => {
    const scope = getRequestScope();
    if (!scope) return;
    try {
      const list = await api<WorkspaceSummary[]>('/v1/workspaces', { noWorkspace: true, scope });
      if (!isScopeCurrent(scope)) return;
      const nextId = list.some((w) => w.id === scope.workspaceId) ? scope.workspaceId : list.length === 1 ? list[0]!.id : null;
      // Cache writes are account scoped and serialized with sign-out cleanup.
      await writeWorkspaceCache(scope.userId, list, nextId);
      if (!isScopeCurrent(scope)) return;
      if (nextId !== scope.workspaceId) {
        setRequestScope(scope.userId, nextId);
        queryClient.clear();
      }
      setWorkspaces(list);
      setActiveId(nextId);
    } catch { /* Offline metadata keeps capture available; every server action still authorizes membership. */ }
  }, []);

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    let disposed = false;
    const installSession = (next: Session | null) => {
      if (disposed) return;
      setSession(next);
      const userId = next?.user.id ?? null;
      if (initializingUser.current === userId) return;
      initializingUser.current = userId;
      setRequestScope(userId);
      queryClient.clear();
      setWorkspaces([]);
      setActiveId(null);
      setReady(!userId);
      if (!userId) return;
      const scope = getRequestScope()!;
      let hydratedScope = scope;
      // Defer outside Supabase's auth callback lock before making API calls.
      setTimeout(() => {
        void readWorkspaceCache(userId).then((cache) => {
          if (disposed || !isScopeCurrent(scope)) return;
          setWorkspaces(cache.workspaces);
          setActiveId(cache.activeId);
          setRequestScope(userId, cache.activeId);
          hydratedScope = getRequestScope()!;
        }).catch(() => undefined).finally(() => {
          if (disposed || !isScopeCurrent(hydratedScope)) return;
          setReady(true);
          void refreshWorkspaces();
        });
      }, 0);
    };
    const client = supabase();
    const { data: subscription } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') signedOutRevision.current += 1;
      installSession(next);
    });
    // An auth event may beat getSession; never overwrite that newer session.
    void client.auth.getSession().then(({ data }) => {
      if (initializingUser.current === undefined) installSession(data.session);
    }).catch(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; initializingUser.current = undefined; subscription.subscription.unsubscribe(); };
  }, [configured, refreshWorkspaces]);

  const selectWorkspace = useCallback(async (id: string | null) => {
    const scope = getRequestScope();
    if (!scope || (id && !workspaces.some((w) => w.id === id))) return;
    setRequestScope(scope.userId, id); // Abort old work synchronously, before any await.
    setActiveId(id);
    await queryClient.cancelQueries();
    queryClient.clear();
    await setActiveWorkspaceId(scope.userId, id);
  }, [workspaces]);

  const signOut = useCallback(() => {
    if (signingOut.current) return signingOut.current;
    const userId = getRequestScope()?.userId;
    const revision = signedOutRevision.current;
    const operation = signOutConfirmed(
      () => supabase().auth.signOut({ scope: 'local' }),
      () => signedOutRevision.current > revision && getRequestScope() === null,
      async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        if (userId) await clearWorkspaceCache(userId);
      },
    ).finally(() => { signingOut.current = null; });
    signingOut.current = operation;
    return operation;
  }, []);

  const value = useMemo<SessionState>(() => ({
    ready, configured, session, workspaces,
    workspace: workspaces.find((w) => w.id === activeId) ?? null,
    refreshWorkspaces, selectWorkspace, signOut,
  }), [ready, configured, session, workspaces, activeId, refreshWorkspaces, selectWorkspace, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
export const useIsOwner = (): boolean => useSession().workspace?.role === 'OWNER';
