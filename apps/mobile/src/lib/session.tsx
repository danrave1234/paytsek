import type { Session } from '@supabase/supabase-js';
import type { WorkspaceSummary } from '@paytsek/contracts';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { isConfigured } from './env';
import { supabase } from './supabase';
import { getActiveWorkspaceId, setActiveWorkspaceId } from './workspace';
import { queryClient } from './queries';

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

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await api<WorkspaceSummary[]>('/v1/workspaces', { noWorkspace: true });
      setWorkspaces(list);
      const current = await getActiveWorkspaceId();
      if (current && !list.some((w) => w.id === current)) {
        await setActiveWorkspaceId(null);
        setActiveId(null);
      } else if (!current && list.length === 1 && list[0]) {
        await setActiveWorkspaceId(list[0].id);
        setActiveId(list[0].id);
      } else {
        setActiveId(current);
      }
    } catch {
      // offline: keep previous list
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const client = supabase();
    void client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refreshWorkspaces();
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await refreshWorkspaces();
      else {
        queryClient.clear();
        setWorkspaces([]);
        setActiveId(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [configured, refreshWorkspaces]);

  const selectWorkspace = useCallback(async (id: string | null) => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await setActiveWorkspaceId(id);
    setActiveId(id);
  }, []);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase().auth.signOut();
    await setActiveWorkspaceId(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      configured,
      session,
      workspaces,
      workspace: workspaces.find((w) => w.id === activeId) ?? null,
      refreshWorkspaces,
      selectWorkspace,
      signOut,
    }),
    [ready, configured, session, workspaces, activeId, refreshWorkspaces, selectWorkspace, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export const useIsOwner = (): boolean => useSession().workspace?.role === 'OWNER';
