import Image from 'next/image';
import Link from 'next/link';
import { PROVIDER_SUPPORT } from '@/lib/providers';
import { latest } from '@/lib/releases';

const sampleRows = [
  { time: '8:42 PM', wallet: 'GCash', state: 'Strong match', amount: '₱850.00', tone: 'brand' },
  { time: '7:18 PM', wallet: 'Maya', state: 'Recorded', amount: '₱240.00', tone: 'plain' },
  { time: '6:05 PM', wallet: 'GoTyme', state: 'Owner confirmed', amount: '₱1,200.00', tone: 'ok' },
] as const;

function ScanGlyph({ className = 'size-6' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 7.5h3v3h-3zM13.5 7.5h3v3h-3zM7.5 13.5h3v3h-3z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 14h1.5v1.5H17V17h-3v-3Z" fill="currentColor" />
    </svg>
  );
}

function TodayPreview() {
  return (
    <div className="phone-v2 mx-auto w-full max-w-[370px]" aria-label="Sample PayTsek Today screen">
      <div className="phone-v2-screen">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/paytsek-icon.png" alt="" width={38} height={38} className="size-9 rounded-lg" />
            <div>
              <p className="text-sm font-bold tracking-[-.02em]">PayTsek</p>
              <p className="text-[10px] text-ink-3">Sample workspace</p>
            </div>
          </div>
          <div className="size-8 rounded-full border border-line bg-bg-2" />
        </div>

        <div className="px-5 pb-28 pt-4">
          <p className="text-[11px] text-ink-3">Today · local workspace time</p>
          <p className="mt-2 text-xl font-semibold tracking-[-.035em]">Recorded today</p>
          <p className="data mt-2 text-[2.7rem] font-semibold leading-none tracking-[-.06em]">₱2,290.00</p>
          <p className="mt-2 text-xs text-ink-3">3 payments</p>

          <div className="mt-8 flex h-20 items-end gap-1.5" aria-hidden>
            {[15, 22, 18, 35, 20, 50, 31, 68, 42, 84, 57, 30].map((height, i) => (
              <span key={i} className="flex-1 rounded-t-sm bg-brand/80" style={{ height: `${height}%`, opacity: 0.2 + i * 0.055 }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-ink-3"><span>12 AM</span><span>12 PM</span><span>11 PM</span></div>

          <div className="mt-7 flex items-center justify-between border-b border-line pb-3">
            <p className="text-xs font-semibold">Latest records</p>
            <span className="text-[10px] font-semibold text-brand">View all</span>
          </div>
          <div>
            {sampleRows.map((row) => (
              <div key={row.time} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line py-3 last:border-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`size-2 rounded-full ${row.tone === 'ok' ? 'bg-ok' : row.tone === 'brand' ? 'bg-brand' : 'bg-ink-3'}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold">{row.wallet}</p>
                    <p className="mt-0.5 text-[9px] text-ink-3">{row.time} · {row.state}</p>
                  </div>
                </div>
                <p className="data self-center text-[11px] font-semibold">{row.amount}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 grid h-[74px] grid-cols-3 items-center rounded-t-[22px] border-t border-line bg-bg px-3 shadow-[0_-10px_30px_rgba(16,24,40,.08)]">
          <span className="text-center text-[9px] font-semibold text-brand">Today</span>
          <span className="mx-auto -translate-y-3 rounded-[19px] border-[5px] border-bg-2 bg-brand p-3 text-white shadow-lg shadow-brand/25">
            <ScanGlyph className="size-7" />
          </span>
          <span className="text-center text-[9px] font-semibold text-ink-3">Records</span>
        </div>
      </div>
      <span className="phone-v2-glow" aria-hidden />
    </div>
  );
}

export default function Home() {
  const rel = latest();

  return (
    <>
      <section className="hero-mesh overflow-hidden px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <div className="fade-up relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg/70 px-3 py-1.5 backdrop-blur">
              <span className="size-2 rounded-full bg-ok" aria-hidden />
              <span className="text-xs font-semibold text-ink-2">Free Android beta · v{rel.version}</span>
            </div>
            <h1 className="h-display mt-7 max-w-2xl text-[clamp(3.2rem,8vw,6.4rem)] leading-[.9]">
              Every QR sale.<br /><span className="text-brand">Already counted.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-8 text-ink-2 sm:text-lg">
              Scan a payment proof. PayTsek reads the amount, wallet and time, saves the record, and keeps today&apos;s total ready.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/download" className="btn-primary">Get the Android beta <span aria-hidden>→</span></Link>
              <Link href="/dashboard" className="btn-secondary">Open dashboard</Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-ink-3">No card required. PayTsek never moves or holds your money.</p>
          </div>

          <div className="fade-up-delay relative px-2 sm:px-10 lg:px-0">
            <div className="absolute -left-8 top-24 hidden rounded-2xl border border-line bg-bg/85 px-4 py-3 shadow-raised backdrop-blur sm:block">
              <p className="eyebrow">Saved in seconds</p>
              <p className="data mt-1 text-lg font-semibold">₱850.00</p>
            </div>
            <div className="absolute -right-5 bottom-28 z-20 hidden rounded-2xl border border-brand/20 bg-brand px-4 py-3 text-white shadow-raised sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-white/60">Evidence</p>
              <p className="mt-1 text-sm font-semibold">Strong match</p>
            </div>
            <TodayPreview />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-9 gap-y-4 px-4 py-5 sm:px-6">
          <p className="eyebrow mr-auto">Built for Philippine QR payments</p>
          {PROVIDER_SUPPORT.map((provider) => (
            <span key={provider.provider} className="text-sm font-semibold text-ink-2">{provider.name}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow text-brand">One simple flow</p>
            <h2 className="h-section mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1.02]">Less typing.<br />More selling.</h2>
            <p className="mt-5 max-w-md leading-7 text-ink-2">The proof is the input. Review only when PayTsek is unsure.</p>
          </div>
          <ol className="border-t border-line">
            {[
              ['01', 'Scan', 'Point the camera at the customer’s confirmation or choose a screenshot.'],
              ['02', 'Record', 'Amount, wallet and time are read on the phone and saved automatically.'],
              ['03', 'Check', 'If your Android payment phone has a nearby incoming notification, PayTsek adds it as evidence.'],
            ].map(([number, title, body]) => (
              <li key={number} className="grid gap-4 border-b border-line py-8 sm:grid-cols-[72px_150px_1fr] sm:items-baseline">
                <span className="data text-xs text-brand">{number}</span>
                <h3 className="text-xl font-semibold tracking-[-.03em]">{title}</h3>
                <p className="max-w-lg text-[15px] leading-7 text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 sm:px-6">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-ink px-6 py-16 text-white sm:px-10 lg:px-16 lg:py-24">
          <div className="grid items-center gap-14 lg:grid-cols-[.92fr_1.08fr] lg:gap-24">
            <div>
              <p className="eyebrow !text-white/45">Your day at a glance</p>
              <h2 className="h-section mt-4 text-[clamp(2.4rem,5vw,4.6rem)] leading-[.98] text-white">The total is waiting when closing time comes.</h2>
              <p className="mt-6 max-w-lg text-[16px] leading-8 text-white/60">No spreadsheet during the rush. Today updates as records are saved, even when a scan has to wait offline.</p>
            </div>
            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.06] p-5 sm:p-7">
              <div className="flex items-end justify-between border-b border-white/10 pb-6">
                <div><p className="text-xs text-white/45">Recorded today</p><p className="data mt-2 text-4xl font-semibold tracking-[-.06em]">₱2,290.00</p></div>
                <span className="text-xs text-white/45">3 records</span>
              </div>
              {sampleRows.map((row) => (
                <div key={row.time} className="grid grid-cols-[82px_1fr_auto] items-center gap-3 border-b border-white/10 py-4 last:border-0">
                  <span className="data text-xs text-white/45">{row.time}</span>
                  <span className="text-sm font-semibold text-white/80">{row.wallet}<span className="ml-2 hidden text-xs font-normal text-white/35 sm:inline">{row.state}</span></span>
                  <span className="data text-sm font-semibold">{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <div className="evidence-orbit relative mx-auto aspect-square w-full max-w-md rounded-full border border-line">
            <div className="absolute left-[8%] top-[26%] w-[58%] rounded-2xl border border-line bg-bg p-5 shadow-raised">
              <p className="eyebrow">Payment proof</p><p className="data mt-3 text-2xl font-semibold">₱850.00</p><p className="mt-1 text-sm text-ink-3">GCash · 8:42 PM</p>
            </div>
            <div className="absolute bottom-[24%] right-[6%] w-[58%] rounded-2xl border border-brand/20 bg-brand p-5 text-white shadow-raised">
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-white/55">Phone notification</p><p className="data mt-3 text-2xl font-semibold">₱850.00</p><p className="mt-1 text-sm text-white/60">Nearby · linked</p>
            </div>
            <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[6px] border-bg-2 bg-ok text-lg text-white">✓</span>
          </div>
          <div>
            <p className="eyebrow text-brand">Optional wallet evidence</p>
            <h2 className="h-section mt-4 text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.02]">A second signal, without a false promise.</h2>
            <p className="mt-6 text-[16px] leading-8 text-ink-2">On Android, PayTsek can compare a proof with an incoming-payment notification from your own phone. A match helps you review faster; it is never presented as provider verification.</p>
            <div className="mt-8 border-l-2 border-brand pl-5">
              <p className="font-semibold">The record is saved either way.</p>
              <p className="mt-1 text-sm leading-6 text-ink-3">Missed notifications never erase a sale from your ledger.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-bg px-4 py-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-9 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow text-brand">Free public beta</p>
            <h2 className="h-section mt-4 text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">Make the next payment the first clean record.</h2>
          </div>
          <Link href="/download" className="btn-primary shrink-0">Download for Android <span aria-hidden>↓</span></Link>
        </div>
      </section>
    </>
  );
}
