'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { WorkspaceSummary } from '@paytsek/contracts';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type Workspace = WorkspaceSummary;
type RecordRow = { id: string; amountCentavos: number; currency: 'PHP'; evidenceState: string; sourceLabel: string; capturedAt: string; receiptTransactionAt: string | null };
type Home = { today: { recordedCount: number; recordedCentavos: number; notificationMatchedCount: number; notificationMatchedCentavos: number; confirmedManuallyCount: number; confirmedManuallyCentavos: number; unverifiedCount: number; unverifiedCentavos: number; reviewRequiredCount: number; hourlyRecordedCentavos: number[] }; recentRecords: RecordRow[]; collectors: Array<{ deviceId: string; label: string; sourceLabel: string; lastSeenAt: string | null; stale: boolean; notificationAccessGranted: boolean | null }> };
type Device = { id: string; label: string; platform: string; status: string; lastServerContactAt: string | null; appVersion: string | null };
type Member = { userId: string; displayName: string; email: string | null; role: string; joinedAt: string };
type DashboardData = { home: Home; devices: Device[]; members: Member[] };

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const time = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

function amount(centavos: number) { return php.format(centavos / 100); }
function detailError(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export function DashboardClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Keep the authenticated shell in a loading state until the workspace list
  // has settled. Without this, an existing owner briefly sees onboarding.
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const workspace = useMemo(() => workspaces.find((item) => item.id === workspaceId) ?? null, [workspaces, workspaceId]);
  const owner = workspace?.role === 'OWNER';

  const request = useCallback(async <T,>(path: string, token: string, workspace?: string, init?: RequestInit): Promise<T> => {
    if (!apiUrl) throw new Error('The dashboard is not configured yet. Missing public API URL.');
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'x-paytsek-api-version': 'v1', ...(workspace ? { 'x-paytsek-workspace': workspace } : {}), ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message ?? `Request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
  }, []);

  const loadWorkspace = useCallback(async (token: string, selectedId: string) => {
    setLoading(true); setMessage(null);
    try {
      const [home, devices, members] = await Promise.all([
        request<Home>('/v1/home', token, selectedId),
        request<Device[]>('/v1/devices', token, selectedId),
        request<Member[]>('/v1/workspaces/current/members', token, selectedId),
      ]);
      setData({ home, devices, members });
    } catch (error) { setData(null); setMessage(detailError(error)); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    let mounted = true;
    let supabase;
    try { supabase = getSupabaseBrowserClient(); }
    catch (error) { setMessage(detailError(error)); setLoading(false); return; }
    supabase.auth.getSession().then(({ data: auth }) => { if (mounted) { setSession(auth.session); setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setWorkspaces([]); setWorkspaceId(''); setData(null); setWorkspacesLoading(false); return; }
    setWorkspacesLoading(true);
    request<Workspace[]>('/v1/workspaces', session.access_token).then((items) => {
      setWorkspaces(items);
      const remembered = localStorage.getItem('paytsek.web.workspace');
      const selected = items.some((item) => item.id === remembered) ? remembered! : items[0]?.id ?? '';
      setWorkspaceId(selected);
    }).catch((error) => setMessage(detailError(error))).finally(() => setWorkspacesLoading(false));
  }, [request, session]);

  useEffect(() => { if (session && workspaceId) { localStorage.setItem('paytsek.web.workspace', workspaceId); void loadWorkspace(session.access_token, workspaceId); } }, [loadWorkspace, session, workspaceId]);

  async function signIn() {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
      if (error) throw error;
    } catch (error) { setMessage(detailError(error)); }
  }

  async function signOut() { await getSupabaseBrowserClient().auth.signOut(); setData(null); }

  async function createWorkspace(name: string) {
    if (!session) return;
    setCreatingWorkspace(true); setMessage(null);
    try {
      const fallbackName = session.user.email?.split('@')[0] ?? 'Workspace owner';
      const ownerDisplayName = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : fallbackName;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
      const created = await request<Workspace>('/v1/workspaces', session.access_token, undefined, { method: 'POST', body: JSON.stringify({ name, timezone, ownerDisplayName }) });
      setWorkspaces((current) => [...current, created]);
      setWorkspaceId(created.id);
    } catch (error) { setMessage(detailError(error)); }
    finally { setCreatingWorkspace(false); }
  }

  if (loading || (session && workspacesLoading)) return <DashboardShell><Loading /></DashboardShell>;
  if (!session) return <DashboardShell><SignIn message={message} onSignIn={signIn} /></DashboardShell>;
  if (!workspaces.length && !message) return <DashboardShell><EmptyWorkspace creating={creatingWorkspace} onCreate={createWorkspace} /></DashboardShell>;

  return <DashboardShell>
    <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="eyebrow text-brand">{new Intl.DateTimeFormat('en-PH', { timeZone: workspace?.timezone, dateStyle: 'full' }).format(new Date())}</p><h1 className="h-display mt-2 text-3xl sm:text-4xl">Recorded today.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">A clean record of scanned payments, not a wallet balance.</p></div>
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3"><select aria-label="Choose workspace" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium sm:w-[190px] sm:flex-none">{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={signOut} className="shrink-0 whitespace-nowrap rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">Sign out</button></div>
    </section>
    {message ? <p role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{message}</p> : null}
    {loading || !data ? <Loading /> : <>
      <section className="grid overflow-hidden rounded-[1.75rem] border border-line bg-bg lg:grid-cols-[1.35fr_.65fr]">
        <div className="min-w-0 p-6 sm:p-10"><p className="text-sm text-ink-3">Recorded today</p><p className="data mt-4 break-words text-[clamp(2.65rem,14vw,3.75rem)] font-semibold tracking-[-.06em]">{amount(data.home.today.recordedCentavos)}</p><p className="mt-3 text-sm text-ink-3">{data.home.today.recordedCount} record{data.home.today.recordedCount === 1 ? '' : 's'}</p></div>
        <div className="border-t border-line p-7 lg:border-l lg:border-t-0"><p className="eyebrow">Evidence</p><dl className="mt-5 space-y-4 text-sm"><EvidenceCount label="Strong match" value={data.home.today.notificationMatchedCount} /><EvidenceCount label="Owner confirmed" value={data.home.today.confirmedManuallyCount} /><EvidenceCount label="Possible match" value={data.home.today.reviewRequiredCount} /><EvidenceCount label="Recorded" value={data.home.today.unverifiedCount} /></dl></div>
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <Panel title="Latest records" action="Synced from mobile"><div className="divide-y divide-line">{data.home.recentRecords.length ? data.home.recentRecords.map((record) => <div key={record.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 py-3.5 sm:grid-cols-[82px_minmax(0,1fr)_auto] sm:gap-3"><p className="data text-xs text-ink-3">{recordTime(record, workspace?.timezone)}</p><div className="min-w-0"><p className="truncate text-sm font-semibold">{record.sourceLabel}</p><p className="mt-1 text-xs text-ink-3">{stateLabel(record.evidenceState)}</p></div><p className="data shrink-0 text-sm font-semibold">{amount(record.amountCentavos)}</p></div>) : <Empty label="No records yet today." />}</div></Panel>
        <Panel title="Payment phone"><div className="divide-y divide-line">{data.home.collectors.length ? data.home.collectors.map((collector) => <div key={collector.deviceId} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{collector.sourceLabel}</p><p className="mt-1 text-xs text-ink-3">{collector.lastSeenAt ? `Seen ${time.format(new Date(collector.lastSeenAt))}` : 'Not connected yet'}</p></div><span className={`pill shrink-0 ${collector.stale ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>{collector.stale ? 'Needs attention' : 'Ready'}</span></div>) : <Empty label="Pair an Android payment phone to add notification evidence." />}</div></Panel>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title={`Team · ${data.members.length}`} action={owner ? 'Manage in mobile app' : undefined}><div className="divide-y divide-line">{data.members.map((member) => <div key={member.userId} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.displayName}</p><p className="break-all text-xs text-ink-3">{member.email ?? 'No email shared'}</p></div><span className="pill shrink-0 bg-bg-3 text-ink-2">{member.role.toLowerCase()}</span></div>)}</div></Panel>
        <Panel title={`Devices · ${data.devices.length}`} action="Pair scanners in mobile app"><div className="divide-y divide-line">{data.devices.length ? data.devices.map((device) => <div key={device.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{device.label}</p><p className="text-xs text-ink-3">{device.platform} · {device.lastServerContactAt ? `seen ${time.format(new Date(device.lastServerContactAt))}` : 'not seen yet'}</p></div><span className={`pill shrink-0 ${device.status === 'ACTIVE' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{device.status.toLowerCase()}</span></div>) : <Empty label="Pair a scanner or notification phone from the mobile app." />}</div></Panel>
      </section>
    </>}
  </DashboardShell>;
}

function DashboardShell({ children }: { children: ReactNode }) { return <div className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-4 pt-6 sm:px-6 sm:pt-12">{children}</div>; }
function Loading() { return <div className="grid gap-4 sm:grid-cols-2"><div className="h-36 animate-pulse rounded-3xl bg-bg-3" /><div className="h-36 animate-pulse rounded-3xl bg-bg-3" /><div className="h-52 animate-pulse rounded-3xl bg-bg-3 sm:col-span-2" /></div>; }
function SignIn({ message, onSignIn }: { message: string | null; onSignIn: () => void }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLocalMessage(null);
    try {
      const client = getSupabaseBrowserClient();
      const result = mode === 'sign-in'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === 'create' && !result.data.session) setLocalMessage('Check your email to finish creating the account.');
    } catch {
      setLocalMessage('Couldn’t continue. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="card-raised mx-auto w-full max-w-lg p-5 sm:p-10">
    <p className="eyebrow text-brand">PayTsek workspace</p>
    <h1 className="h-display mt-3 text-3xl">Your payment records, in one place.</h1>
    <p className="mt-4 text-sm leading-6 text-ink-2">Use the same account as the PayTsek app.</p>
    {message || localMessage ? <p role="alert" className="mt-5 text-sm text-danger">{localMessage ?? message}</p> : null}
    <button onClick={onSignIn} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-night px-5 text-sm font-semibold text-on-brand hover:bg-brand-solid-hover">Continue with Google</button>
    <div className="my-4 flex items-center gap-3 text-[11px] text-ink-3"><span className="h-px flex-1 bg-line" /><span>or</span><span className="h-px flex-1 bg-line" /></div>
    {!emailOpen ? <button onClick={() => setEmailOpen(true)} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-bg px-5 text-sm font-semibold">Continue with email</button> : <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 rounded-xl bg-bg-2 p-1 text-sm font-semibold"><button type="button" onClick={() => setMode('sign-in')} className={`rounded-lg py-2 ${mode === 'sign-in' ? 'bg-bg shadow-sm' : 'text-ink-3'}`}>Sign in</button><button type="button" onClick={() => setMode('create')} className={`rounded-lg py-2 ${mode === 'create' ? 'bg-bg shadow-sm' : 'text-ink-3'}`}>Create account</button></div>
      <label className="block"><span className="sr-only">Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand" /></label>
      <label className="block"><span className="sr-only">Password</span><input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand" /></label>
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-solid px-5 text-sm font-semibold text-on-brand hover:bg-brand-solid-hover disabled:opacity-60">{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
    </form>}
    <p className="mt-4 text-xs leading-5 text-ink-3">Scanning and notification collection stay on Android.</p>
  </div>;
}
function EmptyWorkspace({ creating, onCreate }: { creating: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const trimmed = name.trim(); if (trimmed) onCreate(trimmed); }
  return <div className="card-raised mx-auto max-w-lg p-5 sm:p-8"><p className="eyebrow text-brand">First workspace</p><h1 className="h-display mt-2 text-2xl">Set up your payment records.</h1><p className="mt-3 text-sm leading-6 text-ink-2">Use the name your team will recognize. You can pair the payment phone and scanners in the mobile app afterwards.</p><form className="mt-6" onSubmit={submit}><label htmlFor="workspace-name" className="text-sm font-semibold">Workspace name</label><input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Luna’s Store" maxLength={80} required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand" /><button type="submit" disabled={creating || !name.trim()} className="mt-3 min-h-12 w-full rounded-xl bg-brand-solid px-5 text-sm font-semibold text-on-brand hover:bg-brand-solid-hover disabled:opacity-60">{creating ? 'Creating workspace…' : 'Create workspace'}</button></form></div>;
}
function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) { return <section className="card-raised min-w-0 p-5 sm:p-6"><div className="mb-4 flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3"><h2 className="text-base font-semibold tracking-[-.02em]">{title}</h2>{action ? <span className="text-xs text-ink-3 sm:text-right">{action}</span> : null}</div>{children}</section>; }
function Empty({ label }: { label: string }) { return <p className="py-5 text-sm text-ink-3">{label}</p>; }
function EvidenceCount({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between gap-4"><dt className="text-ink-2">{label}</dt><dd className="data font-semibold">{value}</dd></div>; }
function recordTime(record: RecordRow, timezone = 'Asia/Manila') { return new Intl.DateTimeFormat('en-PH', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(record.receiptTransactionAt ?? record.capturedAt)); }
function stateLabel(state: string) { return ({ UNVERIFIED: 'Recorded', REVIEW_REQUIRED: 'Possible match', MATCHED_AUTO: 'Strong match', MATCHED_BY_USER: 'Strong match', CONFIRMED_MANUALLY: 'Owner confirmed', VOIDED: 'Voided' } as Record<string, string>)[state] ?? 'Recorded'; }
