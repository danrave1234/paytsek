import Link from 'next/link';
import { CertaintyScale } from '@/components/certainty-scale';
import { ProofScene } from '@/components/proof-scene';
import { CheckFigure, FileFigure, ScanFigure } from '@/components/step-figures';
import { PROVIDER_SUPPORT } from '@/lib/providers';
import { latest } from '@/lib/releases';

/** The three steps, drawn as a sequence with a figure at each stage. */
const steps = [
  {
    n: '01',
    kicker: 'Capture',
    title: 'Scan the confirmation screen',
    body: 'Point the camera at the customer’s phone, import their screenshot, or take it straight from the share sheet. The text is read on your phone — the image is never uploaded just to read it.',
    figure: <ScanFigure />,
  },
  {
    n: '02',
    kicker: 'Record',
    title: 'File it as a real record',
    body: 'Amount, reference, sender and recipient become separate fields, stored alongside the original text and every correction you make. Nothing is overwritten, so you can always see what the screen actually said.',
    figure: <FileFigure />,
  },
  {
    n: '03',
    kicker: 'Check',
    title: 'Match it against your own phone',
    body: 'The Android phone that receives your payment notifications reports what actually landed. A record only becomes “Notification matched” when the reference and amount agree exactly — never on amount and time alone.',
    figure: <CheckFigure />,
  },
];

const setups = [
  { tag: 'A', title: 'One Android phone', body: 'Scans confirmations and collects your notifications. Nothing to pair.' },
  {
    tag: 'B',
    title: 'iPhone + Android payment phone',
    body: 'iPhone at the counter, Android payment phone anywhere with internet. Paired with a 5-minute code — no Bluetooth, no shared Wi-Fi.',
  },
  {
    tag: 'C',
    title: 'All-iPhone team',
    body: 'Recording and manual confirmation, clearly labelled. iOS cannot read other apps’ notifications and we never pretend it can.',
  },
];

const refusals: [string, string][] = [
  ['Show wallet balances', 'We never see your balance, your history, or your credentials — only the notifications you allow.'],
  ['Verify with the provider', 'No authenticated provider integration exists here. Claiming one would be a lie.'],
  ['Upload OTPs or promos', 'Security prompts, outgoing payments and marketing are dropped on the phone, before anything is uploaded.'],
  ['Collect GPS or contacts', 'No location, no contacts, no hardware identifiers. Devices use an app-generated ID.'],
  ['Guarantee against fraud', 'A matched record is evidence you can show and audit, not a fraud shield.'],
  ['Pretend to be a wallet', 'PayRecord is independent and is not affiliated with GCash, GoTyme, Maya, or any bank.'],
];

export default function Home() {
  const rel = latest();

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════ Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-52 size-[42rem] rounded-full opacity-70 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(11,95,255,0.14), transparent 65%)' }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:pb-24 lg:pt-16">
          <div>
            <p className="eyebrow flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />
              Now in beta
              <span aria-hidden className="text-line">/</span>
              <span className="data">v{rel.version}</span>
              <span aria-hidden className="text-line">/</span>
              <span className="data">{rel.date}</span>
            </p>

            <h1 className="h-display mt-6 text-[clamp(2.5rem,6.5vw,4.1rem)] leading-[1.04]">
              Trust the payment, <span className="marked">not the screenshot</span>.
            </h1>

            <p className="mt-7 max-w-xl text-[16px] leading-7 text-ink-2 sm:text-[17.5px] sm:leading-8">
              Customers pay your GCash, GoTyme or Maya QR and show you a confirmation screen. PayRecord files that
              confirmation as a proper record, then checks it against the incoming-payment notification on your own phone —
              so you know what actually landed. <span className="text-ink">We never touch the money.</span>
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/download" className="btn-primary">
                Download for Android <span aria-hidden>→</span>
              </Link>
              <Link href="#how" className="btn-secondary">
                See how it works
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[540px] lg:mx-0">
            <ProofScene />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ The problem
          Narrow measure, big type, tinted ground: the one moment on the page
          that is purely an argument, so it gets its own weight and rhythm. */}
      <section className="border-y border-line bg-bg-2">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <p className="eyebrow">Why this exists</p>
          <p className="h-display mt-6 text-[clamp(1.9rem,5vw,3.2rem)] leading-[1.1]">
            A screenshot is not a payment. It is a picture of one.
          </p>
          <p className="mx-auto mt-7 max-w-xl text-pretty text-[17px] leading-8 text-ink-2">
            Anyone can edit an amount, resend an old confirmation, or show you one addressed to somebody else. At a busy
            counter you have seconds to decide, and the only thing that actually proves money arrived is your own phone.
          </p>

          <ul className="mx-auto mt-11 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
            {[
              ['Edited', 'An amount changed in a photo editor in under a minute.'],
              ['Reused', 'A real confirmation from last week, shown again today.'],
              ['Misread', 'A genuine payment — sent to a different account entirely.'],
            ].map(([k, v]) => (
              <li key={k} className="rounded-xl border border-line bg-bg px-4 py-4">
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-danger">{k}</p>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-2">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ How it works (sequence)
          Alternating rows joined by a numbered rail, so the three steps read
          as one process instead of three parallel features. */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow">The flow</p>
          <h2 className="h-section mt-3 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-tight">
            Three steps, and one of them is not yours to fake
          </h2>
        </div>

        <ol className="mt-16 space-y-20 lg:space-y-28">
          {steps.map((s, i) => (
            <li key={s.n} className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              {/* Connector between steps, desktop only. */}
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[calc(1.25rem-1px)] top-14 hidden h-[calc(100%+7rem)] w-px bg-gradient-to-b from-line to-transparent lg:block"
                />
              ) : null}

              <div className={i % 2 === 1 ? 'lg:order-2' : undefined}>
                <div className="flex items-center gap-4">
                  <span className="data relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-line bg-bg text-[13px] font-semibold text-brand-2">
                    {s.n}
                  </span>
                  <span className="eyebrow">{s.kicker}</span>
                </div>
                <h3 className="mt-6 text-[clamp(1.4rem,3vw,1.9rem)] font-semibold leading-tight tracking-[-0.03em] lg:pl-14">
                  {s.title}
                </h3>
                <p className="mt-4 max-w-lg text-[15.5px] leading-8 text-ink-2 lg:pl-14">{s.body}</p>
              </div>

              <div className={i % 2 === 1 ? 'lg:order-1' : undefined}>{s.figure}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ═════════════════════════════════════════════════════ Certainty scale */}
      <section className="border-y border-line bg-bg-2">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow">Evidence states</p>
              <h2 className="h-section mt-3 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-tight">
                How sure we are, and where that stops
              </h2>
              <p className="mt-6 leading-8 text-ink-2">
                Every record sits at exactly one point on this scale, and carries the reason it got there. The scale has a
                hard ceiling, and the app says so rather than rounding up.
              </p>
              <Link href="/support" className="ul mt-6 inline-block text-[15px]">
                Read how matching decides
              </Link>
            </div>

            <CertaintyScale />
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════ Wallet support */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow">Wallet support</p>
            <h2 className="h-section mt-3 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-tight">
              What each wallet can actually do today
            </h2>
            <p className="mt-6 leading-8 text-ink-2">
              Recording works everywhere. Automatic matching is switched on per tested payment flow, only once real
              notification samples prove the reference on the customer&apos;s screen is the same identifier your phone
              receives.
            </p>
            <p className="mt-4 text-[14px] leading-7 text-ink-3">
              This table is generated from the app&apos;s own capability registry, so it cannot claim more than the code does.
            </p>
          </div>

          <div className="card overflow-hidden">
            <table className="matrix">
              <thead>
                <tr className="bg-bg-2">
                  <th className="w-[26%] !pl-6">Wallet</th>
                  <th className="w-[24%]">Recording</th>
                  <th className="!pr-6">Automatic matching</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDER_SUPPORT.map((p) => (
                  <tr key={p.name}>
                    <td className="!pl-6 text-[15px] font-semibold tracking-[-0.02em]">{p.name}</td>
                    <td>
                      <span className="pill bg-ok-soft text-ok">Supported</span>
                    </td>
                    <td className="!pr-6">
                      <span className={`pill ${p.autoMatch ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
                        {p.autoMatch ? 'Enabled' : 'Not yet'}
                      </span>
                      <p className="mt-2.5 text-[13.5px] leading-6 text-ink-2">{p.note}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ Setups (deliberately quiet)
          Secondary information: compact type, no cards, so it reads as a
          footnote to the flow rather than a fourth headline act. */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="eyebrow">Setups that work</p>
              <h3 className="mt-3 text-[1.35rem] font-semibold leading-snug tracking-[-0.03em]">
                One phone, two phones, or a counter full of iPhones
              </h3>
            </div>
            <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
              {setups.map((s) => (
                <li key={s.tag}>
                  <p className="data text-[11px] text-ink-3">{s.tag}</p>
                  <h4 className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.02em]">{s.title}</h4>
                  <p className="mt-2 text-[13.5px] leading-6 text-ink-2">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════ Refusals (dark) */}
      <section className="band-dark">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="eyebrow">The fine print, up front</p>
            <h2 className="h-section mt-3 text-[clamp(1.9rem,4.5vw,2.9rem)] leading-tight text-white">
              Six things we refuse to do
            </h2>
            <p className="mt-6 leading-8 text-white/60">
              Most of what goes wrong with payment apps is over-promising. Here is what PayRecord will never claim.
            </p>
          </div>

          <ul className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {refusals.map(([title, body], i) => (
              <li key={title} className="border-t border-white/15 pt-5">
                <p className="data text-[11px] tracking-[0.16em] text-white/30">{String(i + 1).padStart(2, '0')} / 06</p>
                <h3 className="mt-3 text-[1.05rem] font-semibold leading-snug tracking-[-0.02em] text-white">{title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-6 text-white/60">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 lg:pt-28">
        <div className="card-raised flex flex-wrap items-center justify-between gap-8 p-8 sm:p-10">
          <div className="max-w-xl">
            <h2 className="h-section text-[clamp(1.5rem,3.5vw,2.1rem)] leading-tight">Start checking your payments.</h2>
            <p className="mt-3 leading-7 text-ink-2">
              The free plan includes the remote payment-phone workflow, CSV export, and the full evidence trail. No card, no
              wallet access.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/download" className="btn-primary">
              Get the app <span aria-hidden>→</span>
            </Link>
            <Link href="/support" className="btn-secondary">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
