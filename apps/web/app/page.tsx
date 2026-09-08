import Link from 'next/link';
import { latest } from '@/lib/releases';

const steps = [
  { n: '01', title: 'Scan the customer\u2019s receipt', body: 'Camera, screenshot import, or share sheet. Text is read on the phone with on-device OCR. The image is never uploaded just to read it.' },
  { n: '02', title: 'Keep an organized record', body: 'Amount, reference, sender and recipient are stored as separate fields, together with the original OCR and every correction. Search, filter, export CSV.' },
  { n: '03', title: 'Match against your own phone', body: 'The Android phone that receives GCash notifications reports incoming payments. A record becomes \u201cNotification matched\u201d only when reference and amount agree exactly.' },
];

const states = [
  { label: 'Unverified', desc: 'Proof recorded. No notification association yet.', cls: 'border-ink-3 text-ink-2' },
  { label: 'Review needed', desc: 'Candidates or a conflict that needs a person.', cls: 'border-warn text-warn' },
  { label: 'Notif. matched', desc: 'Exact reference and amount agreed. Not a provider confirmation.', cls: 'border-ok text-ok' },
  { label: 'Confirmed', desc: 'Owner checked the wallet directly and signed off.', cls: 'border-stamp text-stamp' },
];

function Receipt() {
  return (
    <div className="receipt mx-auto w-full max-w-[320px] px-6 pt-6 pb-8" aria-hidden>
      <p className="text-center text-[11px] uppercase tracking-[0.25em] text-ink-3">payrecord · record slip</p>
      <p className="mt-1 text-center font-semibold">*** RECORD #00417 ***</p>
      <p className="dots pb-3 text-center text-[11px]">2026-09-08 · 14:32 · Manila</p>
      <dl className="mt-3 space-y-1">
        <div className="flex justify-between"><dt className="text-ink-3">SOURCE</dt><dd>GCash receipt</dd></div>
        <div className="flex justify-between"><dt className="text-ink-3">REF</dt><dd>3021 8845 1129</dd></div>
        <div className="flex justify-between"><dt className="text-ink-3">FROM</dt><dd>M*A L.</dd></div>
        <div className="flex justify-between"><dt className="text-ink-3">TO</dt><dd>Your store</dd></div>
        <div className="dots flex justify-between pb-3"><dt className="text-ink-3">AMOUNT</dt><dd className="font-semibold">₱ 1,250.00</dd></div>
      </dl>
      <dl className="mt-3 space-y-1">
        <div className="flex justify-between"><dt className="text-ink-3">NOTIF</dt><dd>GCash · 14:31</dd></div>
        <div className="flex justify-between"><dt className="text-ink-3">NOTIF REF</dt><dd>3021 8845 1129</dd></div>
        <div className="dots flex justify-between pb-3"><dt className="text-ink-3">NOTIF AMT</dt><dd>₱ 1,250.00</dd></div>
      </dl>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[11px] text-ink-3">STATE</span>
        <span className="stamp border-ok text-ok">matched</span>
      </div>
      <p className="mt-6 text-center text-[10px] leading-4 text-ink-3">
        Evidence, not verification. PayRecord does not hold funds and is not GCash, GoTyme, or a bank.
      </p>
      <div className="mt-4 flex justify-center gap-[2px]">
        {Array.from({ length: 42 }, (_, i) => (
          <span key={i} className="block h-6 bg-ink" style={{ width: i % 3 === 0 ? 2 : 1, opacity: i % 5 === 0 ? 0.45 : 1 }} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const rel = latest();
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-24">
        <div>
          <p className="eyebrow">Now in beta · v{rel.version} · {rel.date}</p>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Every payment gets a <em className="not-italic underline decoration-stamp decoration-[6px] underline-offset-[10px]">paper trail</em>.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-ink-2">
            PayRecord is a recordkeeper for Philippine sellers paid through GCash and GoTyme. Scan the customer&apos;s receipt, file it, and let your own payment phone tell you when the money really landed. Customers keep paying your existing QR or number. We never touch the money.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/download" className="btn-ink">Download for Android <span aria-hidden>→</span></Link>
            <Link href="/updates" className="ul font-mono text-sm uppercase tracking-[0.14em]">Read the release notes</Link>
          </div>
          <p className="mt-8 font-mono text-xs leading-6 text-ink-3">
            Never asks for your MPIN, OTP, or wallet login.<br />
            iPhone app records &amp; confirms; only Android can read notifications.
          </p>
        </div>
        <div className="relative pt-4 lg:pt-0">
          <div className="absolute inset-x-8 -top-2 bottom-8 -rotate-2 bg-paper-3/70 lg:inset-x-6" aria-hidden />
          <Receipt />
        </div>
      </section>

      {/* How it works — ledger table */}
      <section className="border-y-2 border-ink bg-paper-2/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">How a record is made</h2>
            <p className="eyebrow">Three entries, one line each</p>
          </div>
          <table className="ledger mt-8">
            <thead>
              <tr><th className="w-14">No.</th><th className="w-1/3">Entry</th><th>Particulars</th></tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.n}>
                  <td className="font-mono text-ink-3">{s.n}</td>
                  <td className="font-display text-xl font-semibold leading-snug">{s.title}</td>
                  <td className="text-[15px] leading-7 text-ink-2">{s.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence states */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Evidence states</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Stamps that say only what is known</h2>
            <p className="mt-4 leading-7 text-ink-2">No unconditional &ldquo;verified&rdquo; badge, no invented confidence percentages. Each record carries exactly one of four stamps and the reason for it.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {states.map((s) => (
              <li key={s.label} className="border-t border-rule pt-5">
                <span className={`stamp ${s.cls}`}>{s.label}</span>
                <p className="mt-4 text-sm leading-6 text-ink-2">{s.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Two columns: works across phones / what we don't do */}
      <section className="ruled border-y border-rule">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Setups that work</p>
            <ul className="mt-4 space-y-4 text-[15px] leading-8">
              <li><span className="mr-3 font-mono text-ink-3">a.</span>One Android phone scans and collects notifications.</li>
              <li><span className="mr-3 font-mono text-ink-3">b.</span>iPhone at the counter, Android payment phone anywhere with internet — paired with a 5-minute code.</li>
              <li><span className="mr-3 font-mono text-ink-3">c.</span>All-iPhone team: recording and manual confirmation, clearly labelled. iOS cannot read other apps&apos; notifications and PayRecord never pretends it can.</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">Things we refuse to do</p>
            <ul className="mt-4 space-y-4 text-[15px] leading-8">
              <li><span className="mr-3 font-mono text-stamp">×</span>Show wallet balances, verify with banks, or guarantee against fraud.</li>
              <li><span className="mr-3 font-mono text-stamp">×</span>Upload OTPs, security prompts, promos, or outgoing payments — dropped on the phone.</li>
              <li><span className="mr-3 font-mono text-stamp">×</span>Collect GPS, contacts, or hardware identifiers.</li>
              <li><span className="mr-3 font-mono text-stamp">×</span>Pretend to be GCash, GoTyme, or any bank.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="flex flex-wrap items-center justify-between gap-6 border-2 border-ink p-8">
          <div>
            <p className="font-display text-2xl font-semibold sm:text-3xl">Start the paper trail today.</p>
            <p className="mt-1 text-ink-2">Free plan includes the remote payment-phone workflow.</p>
          </div>
          <Link href="/download" className="btn-ink">Get the app</Link>
        </div>
      </section>
    </>
  );
}
