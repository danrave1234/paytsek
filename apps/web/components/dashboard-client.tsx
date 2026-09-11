'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type Workspace = { id: string; name: string; role: 'OWNER' | 'MANAGER' | 'CASHIER'; planCode: string; timezone: string };
type RecordRow = { id: string; amountCentavos: number; currency: 'PHP'; evidenceState: string; payerName: string | null; customerLabel: string | null; sourceLabel: string; capturedAt: string; referenceValue: string | null };
type Home = { today: { notificationMatchedCount: number; notificationMatchedCentavos: number; confirmedManuallyCount: number; confirmedManuallyCentavos: number; unverifiedCount: number; unverifiedCentavos: number; reviewRequiredCount: number }; collectors: Array<{ deviceId: string; label: string; sourceLabel: string; lastSeenAt: string | null; stale: boolean; notificationAccessGranted: boolean | null }>; quota: { monthlyAllowance: number; monthlyUsed: number; prepaidCreditsRemaining: number } };
type Device = { id: string; label: string; platform: string; status: string; lastServerContactAt: string | null; appVersion: string | null };
type Member = { userId: string; displayName: string; email: string | null; role: string; joinedAt: string };
type Usage = { planCode: string; subscriptionStatus: string; managementPlatform: string | null; periodStart: string; periodEnd: string; monthlyAllowance: number; monthlyUsed: number; prepaidCreditsRemaining: number; limits: { scannerDevices: number; collectorDevices: number; receivingSources: number; members: number }; usage: { scannerDevices: number; collectorDevices: number; receivingSources: number; members: number } };
type Product = { key: 'STARTER_30_DAYS' | 'BUSINESS_30_DAYS'; kind: 'SUBSCRIPTION'; planCode: 'STARTER' | 'BUSINESS'; records: number; priceCentavos: number };
type Ledger = { id: string; at: string; kind: string; delta: number; reason: string | null };
type DashboardData = { home: Home; records: RecordRow[]; devices: Device[]; members: Member[]; usage: Usage; products: Product[]; ledger: Ledger[] };

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
      const [home, recordsResponse, devices, members, usage, products, ledger] = await Promise.all([
        request<Home>('/v1/home', token, selectedId),
        request<{ items: RecordRow[] }>('/v1/records?limit=20', token, selectedId),
        request<Device[]>('/v1/devices', token, selectedId),
        request<Member[]>('/v1/workspaces/current/members', token, selectedId),
        request<Usage>('/v1/billing/usage', token, selectedId),
        request<Product[]>('/v1/billing/products', token, selectedId),
        request<Ledger[]>('/v1/billing/ledger', token, selectedId).catch(() => []),
      ]);
      setData({ home, records: recordsResponse.items, devices, members, usage, products, ledger });
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
      const created = await request<Workspace>('/v1/workspaces', session.access_token, undefined, { method: 'POST', body: JSON.stringify({ name, timezone: 'Asia/Manila', ownerDisplayName }) });
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
      <div><p className="eyebrow text-brand">Your workspace</p><h1 className="h-display mt-2 text-3xl sm:text-4xl">Payments, ready to reconcile.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">Records are evidence, not your wallet balance. Use this dashboard for a clean view of the day, team and billing.</p></div>
      <div className="flex items-center gap-3"><select aria-label="Choose workspace" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className="max-w-[190px] rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium">{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={signOut} className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">Sign out</button></div>
    </section>
    {message ? <p role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">{message}</p> : null}
    {loading || !data ? <Loading /> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Notification matched" value={amount(data.home.today.notificationMatchedCentavos)} detail={`${data.home.today.notificationMatchedCount} records`} tone="ok" />
        <Metric label="Confirmed manually" value={amount(data.home.today.confirmedManuallyCentavos)} detail={`${data.home.today.confirmedManuallyCount} records`} tone="brand" />
        <Metric label="Unverified" value={amount(data.home.today.unverifiedCentavos)} detail={`${data.home.today.unverifiedCount} records`} tone="warn" />
        <Metric label="Needs review" value={String(data.home.today.reviewRequiredCount)} detail="records to check" tone="plain" />
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
        <Panel title="Today’s records" action="Open in mobile app"><div className="divide-y divide-line">{data.records.length ? data.records.map((record) => <div key={record.id} className="flex items-center justify-between gap-4 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{record.customerLabel || record.payerName || 'Unknown sender'}</p><p className="mt-1 truncate text-xs text-ink-3">{record.sourceLabel} · {record.referenceValue ?? 'No reference'} · {time.format(new Date(record.capturedAt))}</p></div><div className="shrink-0 text-right"><p className="data text-sm font-semibold">{amount(record.amountCentavos)}</p><p className="mt-1 text-[11px] font-medium text-ink-3">{stateLabel(record.evidenceState)}</p></div></div>) : <Empty label="No records yet today." />}</div></Panel>
        <Panel title="Beta access"><div className="p-1"><p className="text-sm font-semibold">Everything is free during public beta.</p><p className="mt-2 text-sm leading-6 text-ink-2">There is no checkout, subscription or automatic charge. Keep recording payments; an unverified record still counts in your day.</p><a href="/support" className="mt-4 inline-block text-sm font-medium text-brand underline underline-offset-4">Questions or feedback?</a></div></Panel>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title={`Team · ${data.members.length}`} action={owner ? 'Manage in mobile app' : undefined}><div className="divide-y divide-line">{data.members.map((member) => <div key={member.userId} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{member.displayName}</p><p className="text-xs text-ink-3">{member.email ?? 'No email shared'}</p></div><span className="pill bg-bg-3 text-ink-2">{member.role.toLowerCase()}</span></div>)}</div></Panel>
        <Panel title={`Devices · ${data.devices.length}`} action="Pair scanners in mobile app"><div className="divide-y divide-line">{data.devices.length ? data.devices.map((device) => <div key={device.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{device.label}</p><p className="text-xs text-ink-3">{device.platform} · {device.lastServerContactAt ? `seen ${time.format(new Date(device.lastServerContactAt))}` : 'not seen yet'}</p></div><span className={`pill ${device.status === 'ACTIVE' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{device.status.toLowerCase()}</span></div>) : <Empty label="Pair a scanner or notification phone from the mobile app." />}</div></Panel>
      </section>
      <section className="mt-5"><Panel title="Public beta" action="No payment required"><p className="text-sm leading-6 text-ink-2">Billing is disabled while we validate PayTsek with real payment-recording workflows. We will announce any future pricing before it applies.</p></Panel></section>
    </>}
  </DashboardShell>;
}

function DashboardShell({ children }: { children: ReactNode }) { return <div className="mx-auto max-w-6xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12">{children}</div>; }
function Loading() { return <div className="grid gap-4 sm:grid-cols-2"><div className="h-36 animate-pulse rounded-3xl bg-bg-3" /><div className="h-36 animate-pulse rounded-3xl bg-bg-3" /><div className="h-52 animate-pulse rounded-3xl bg-bg-3 sm:col-span-2" /></div>; }
function SignIn({ message, onSignIn }: { message: string | null; onSignIn: () => void }) { return <div className="card-raised mx-auto max-w-lg p-7 sm:p-10"><p className="eyebrow text-brand">PayTsek workspace</p><h1 className="h-display mt-3 text-3xl">Your payment operations, in one place.</h1><p className="mt-4 text-sm leading-6 text-ink-2">Sign in with the Google account you use in PayTsek. Your workspace and permissions follow you here.</p>{message ? <p role="alert" className="mt-5 text-sm text-danger">{message}</p> : null}<button onClick={onSignIn} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-brand">Continue with Google</button><p className="mt-4 text-xs leading-5 text-ink-3">Browser access is for records, team visibility and owner billing. Scanning and notification collection stay on Android.</p></div>; }
function EmptyWorkspace({ creating, onCreate }: { creating: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const trimmed = name.trim(); if (trimmed) onCreate(trimmed); }
  return <div className="card-raised mx-auto max-w-lg p-8"><p className="eyebrow text-brand">First workspace</p><h1 className="h-display mt-2 text-2xl">Set up your payment records.</h1><p className="mt-3 text-sm leading-6 text-ink-2">Use the name your team will recognize. You can pair the payment phone and scanners in the mobile app afterwards.</p><form className="mt-6" onSubmit={submit}><label htmlFor="workspace-name" className="text-sm font-semibold">Workspace name</label><input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Luna’s Store" maxLength={80} required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none placeholder:text-ink-3 focus:border-brand" /><button type="submit" disabled={creating || !name.trim()} className="mt-3 min-h-12 w-full rounded-xl bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60">{creating ? 'Creating workspace…' : 'Create workspace'}</button></form></div>;
}
function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) { return <section className="card-raised p-5 sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-base font-semibold tracking-[-.02em]">{title}</h2>{action ? <span className="text-xs text-ink-3">{action}</span> : null}</div>{children}</section>; }
function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'ok' | 'brand' | 'warn' | 'plain' }) { const color = tone === 'ok' ? 'text-ok' : tone === 'brand' ? 'text-brand' : tone === 'warn' ? 'text-warn' : 'text-ink'; return <article className="card p-5"><p className="text-sm font-medium text-ink-2">{label}</p><p className={`data mt-5 text-2xl font-semibold ${color}`}>{value}</p><p className="mt-1 text-xs text-ink-3">{detail}</p></article>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-ink-2">{label}</dt><dd className="data text-right text-ink">{value}</dd></div>; }
function Empty({ label }: { label: string }) { return <p className="py-5 text-sm text-ink-3">{label}</p>; }
function stateLabel(state: string) { return state.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()); }
function shortDate(iso: string) { return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); }
