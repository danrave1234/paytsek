import type {
  CandidatesResponse,
  DeviceSummary,
  HomeSummary,
  ListRecordsResponse,
  MemberSummary,
  OwnerInboxEvent,
  RecordDetail,
  SourceSummary,
  UsageSummary,
  WorkspaceSummary,
} from '@payrecord/contracts';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** One query client; server state is the system of record (no duplicate stores). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnReconnect: true, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

export const keys = {
  workspaces: ['workspaces'] as const,
  home: ['home'] as const,
  sources: ['sources'] as const,
  devices: ['devices'] as const,
  members: ['members'] as const,
  usage: ['usage'] as const,
  inbox: ['inbox'] as const,
  records: (filters: Record<string, unknown>) => ['records', filters] as const,
  record: (id: string) => ['record', id] as const,
  candidates: (id: string) => ['candidates', id] as const,
};

export const useWorkspaces = () => useQuery({ queryKey: keys.workspaces, queryFn: () => api<WorkspaceSummary[]>('/v1/workspaces', { noWorkspace: true }) });
export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => api<HomeSummary>('/v1/home'), refetchInterval: 30_000 });
export const useSources = () => useQuery({ queryKey: keys.sources, queryFn: () => api<SourceSummary[]>('/v1/sources') });
export const useDevices = () => useQuery({ queryKey: keys.devices, queryFn: () => api<DeviceSummary[]>('/v1/devices'), refetchInterval: 30_000 });
export const useMembers = () => useQuery({ queryKey: keys.members, queryFn: () => api<MemberSummary[]>('/v1/workspaces/current/members') });
export const useUsage = () => useQuery({ queryKey: keys.usage, queryFn: () => api<UsageSummary>('/v1/billing/usage') });
export const useInbox = () => useQuery({ queryKey: keys.inbox, queryFn: () => api<OwnerInboxEvent[]>('/v1/inbox?unlinkedOnly=true&limit=100') });

export function useRecords(filters: { q?: string; state?: string[]; sourceId?: string; staffUserId?: string; from?: string; to?: string; cursor?: string }) {
  const qs = new URLSearchParams();
  if (filters.q) qs.set('q', filters.q);
  if (filters.state?.length) qs.set('state', filters.state.join(','));
  if (filters.sourceId) qs.set('sourceId', filters.sourceId);
  if (filters.staffUserId) qs.set('staffUserId', filters.staffUserId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.cursor) qs.set('cursor', filters.cursor);
  qs.set('limit', '30');
  return useQuery({ queryKey: keys.records(filters), queryFn: () => api<ListRecordsResponse>(`/v1/records?${qs.toString()}`) });
}

export const useRecord = (id: string) => useQuery({ queryKey: keys.record(id), queryFn: () => api<RecordDetail>(`/v1/records/${id}`), enabled: !!id });
export const useCandidates = (id: string) => useQuery({ queryKey: keys.candidates(id), queryFn: () => api<CandidatesResponse>(`/v1/records/${id}/candidates`), enabled: !!id, refetchInterval: 20_000 });

/** Invalidate everything that a record-state change can affect. */
export function useInvalidateRecord() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['records'] });
    void qc.invalidateQueries({ queryKey: keys.home });
    void qc.invalidateQueries({ queryKey: keys.inbox });
    if (id) {
      void qc.invalidateQueries({ queryKey: keys.record(id) });
      void qc.invalidateQueries({ queryKey: keys.candidates(id) });
    }
  };
}

export function useConfirmCandidate(recordId: string) {
  const inv = useInvalidateRecord();
  return useMutation({
    mutationFn: (eventId: string) => api(`/v1/records/${recordId}/confirm-candidate`, { method: 'POST', body: { eventId } }),
    onSettled: () => inv(recordId),
  });
}

export function useConfirmManually(recordId: string) {
  const inv = useInvalidateRecord();
  return useMutation({
    mutationFn: (note?: string) => api(`/v1/records/${recordId}/confirm-manually`, { method: 'POST', body: { note: note ?? null } }),
    onSettled: () => inv(recordId),
  });
}

export function useUnlink(recordId: string) {
  const inv = useInvalidateRecord();
  return useMutation({
    mutationFn: (reason: string) => api(`/v1/records/${recordId}/unlink`, { method: 'POST', body: { reason } }),
    onSettled: () => inv(recordId),
  });
}

export function useVoid(recordId: string) {
  const inv = useInvalidateRecord();
  return useMutation({
    mutationFn: (reason: string) => api(`/v1/records/${recordId}/void`, { method: 'POST', body: { reason } }),
    onSettled: () => inv(recordId),
  });
}

export function useEscalate(recordId: string) {
  const inv = useInvalidateRecord();
  return useMutation({
    mutationFn: (message?: string) => api(`/v1/records/${recordId}/escalate`, { method: 'POST', body: { message: message ?? null } }),
    onSettled: () => inv(recordId),
  });
}
