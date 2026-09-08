import Link from 'next/link';
import { latest } from '@/lib/releases';

const steps = [
  { n: '1', title: 'Scan the customer\u2019s receipt', body: 'Camera, screenshot import, or share sheet. Text is read on the phone with on-device OCR \u2014 no cloud upload of the image just to read it.' },
  { n: '2', title: 'Keep an organized record', body: 'Amount, reference, sender and recipient are stored separately with the original OCR and every correction. Search, filter, export.' },
  { n: '3', title: 'Match with your own phone\u2019s notifications', body: 'Your Android phone that receives GCash notifications reports incoming payments. A record turns to \u201cNotification matched\u201d only when the reference and amount agree.' },
];

const states = [
  { label: 'Unverified', desc: 'Proof recorded; no notification association yet.', cls: 'bg-slate-100 text-slate-700' },
  { label: 'Review needed', desc: 'Candidates or a conflict need a person.', cls: 'bg-warn-soft text-warn' },
  { label: 'Notification matched', desc: 'Exact reference + amount agreed. Not a provider confirmation.', cls: 'bg-ok-soft text-ok' },
  { label: 'Confirmed manually', desc: 'Owner checked the wallet directly.', cls: 'bg-brand-soft text-brand-dark' },
];

export default function Home() {
  const rel = latest();
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted dark:border-slate-700 dark:text-slate-300">
          <span className="size-2 rounded-full bg-brand" aria-hidden /> Version {rel.version} {rel.channel === 'beta' ? 'beta' : ''} · {rel.date}
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Scan a payment proof. Keep an organized record. Match it with your own phone&apos;s incoming-payment evidence.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted dark:text-slate-300">
          PayRecord is for Philippine sellers paid through GCash and GoTyme. Customers keep paying your existing QR or number; PayRecord never touches the money and never asks for your MPIN, OTP, or wallet login.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="rounded-xl bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark">Download the app</Link>
          <Link href="/updates" className="rounded-xl border border-line px-5 py-3 font-medium hover:bg-brand-soft/60 dark:border-slate-700 dark:hover:bg-slate-800">See what&apos;s new</Link>
        </div>
      </section>

      <section className="border-y border-line/70 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{s.n}</div>
              <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-muted dark:text-slate-300">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Honest evidence states</h2>
        <p className="mt-2 max-w-2xl text-muted dark:text-slate-300">Every record shows exactly what is known. No unconditional &ldquo;verified&rdquo; badge, no invented percentages.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {states.map((s) => (
            <li key={s.label} className="flex items-start gap-3 rounded-xl border border-line p-4 dark:border-slate-800">
              <span className={`mt-0.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
              <span className="text-sm text-muted dark:text-slate-300">{s.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-6 rounded-2xl border border-line p-6 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-semibold">Works across phones</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted dark:text-slate-300">
              <li>• Same Android phone scans and collects notifications.</li>
              <li>• iPhone cashier + Android payment phone anywhere with internet.</li>
              <li>• All-iPhone team: recording and manual confirmation, clearly labeled. iOS cannot read other apps&apos; notifications and PayRecord never pretends it can.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold">What we don&apos;t do</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted dark:text-slate-300">
              <li>• No wallet balance, no bank verification, no fraud guarantee.</li>
              <li>• No OTPs, security prompts, or outgoing payments are ever uploaded.</li>
              <li>• No GPS, contacts, or hardware identifiers.</li>
              <li>• Not affiliated with GCash, GoTyme, or any bank.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
