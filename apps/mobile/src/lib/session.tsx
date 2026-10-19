import type { Session } from '@supabase/supabase-js';
import type { WorkspaceSummary } from '@paytsek/contracts';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { isConfigured } from './env';
import { supabase } from './supabase';
import { clearWorkspaceCache, readWorkspaceCache, setActiveWorkspaceId, writeWorkspaceCache } from './workspace';
import { pickWorkspace } from './workspace-pick';
import { queryClient } from './queries';
import { getRequestScope, isScopeCurrent, setRequestScope } from './request-scope';
import { signOutConfirmed } from './sign-out';

interface SessionState {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  workspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  /**
   * Load memberships and enter one automatically, creating the account's
   * default workspace when it has none. `preferId` wins when it is a member
   * (e.g. right after joining a team). Resolves true when a workspace is active.
   */
  refreshWorkspaces: (preferId?: string) => Promise<boolean>;
  selectWorkspace: (id: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<SessionState | null>(null);

const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';

function displayNameFor(user: Session['user'] | undefined): string {
  const metadataName = user?.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim();
  return user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Owner';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const configured = isConfigured();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const initializingUser = useRef<string | null | undefined>(undefined);
  const signingOut = useRef<Promise<void> | null>(null);
  const signedOutRevision = useRef(0);

  // One default-workspace creation per account at a time, however many
  // refreshes race (launch, retry button, returning from the background).
  const creatingDefault = useRef<{ userId: string; promise: Promise<WorkspaceSummary> } | null>(null);

  const refreshWorkspaces = useCallback(async (preferId?: string) => {
    const scope = getRequestScope();
    if (!scope) return false;
    try {
      let list = await api<WorkspaceSummary[]>('/v1/workspaces', { noWorkspace: true, scope });
      if (!isScopeCurrent(scope)) return false;
      if (list.length === 0) {
        // PayTsek has no workspace picker: every account simply has its own.
        if (creatingDefault.current?.userId !== scope.userId) {
          // Claim the slot synchronously (no await before this assignment) so
          // concurrent refreshes share one request instead of creating two.
          const promise = (async () => {
            const user = (await supabase().auth.getSession()).data.session?.user;
            return api<WorkspaceSummary>('/v1/workspaces', {
              method: 'POST',
              noWorkspace: true,
              scope,
              body: { name: 'My records', timezone: deviceTimezone(), ownerDisplayName: displayNameFor(user) },
            });
          })();
          creatingDefault.current = { userId: scope.userId, promise };
          void promise.finally(() => { if (creatingDefault.current?.promise === promise) creatingDefault.current = null; });
        }
        list = [await creatingDefault.current!.promise];
        if (!isScopeCurrent(scope)) return false;
      }
      const nextId = pickWorkspace(list, preferId ?? scope.workspaceId);
      // Cache writes are account scoped and serialized with sign-out cleanup.
      await writeWorkspaceCache(scope.userId, list, nextId);
      if (!isScopeCurrent(scope)) return false;
      if (nextId !== scope.workspaceId) {
        setRequestScope(scope.userId, nextId);
        queryClient.clear();
      }
      setWorkspaces(list);
      setActiveId(nextId);
      return nextId !== null;
    } catch {
      // Offline metadata keeps capture available; every server action still authorizes membership.
      return getRequestScope()?.workspaceId != null;
    }
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
