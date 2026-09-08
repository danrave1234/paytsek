import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { DOWNLOADS, GITHUB_RELEASES_URL, latest } from '@/lib/releases';

export const metadata: Metadata = { title: 'Download', description: 'Get PayRecord for Android and iPhone.' };

const installSteps: ReactNode[] = [
  <>
    Open the{' '}
    <a className="ul" href={`${GITHUB_RELEASES_URL}/latest`} rel="noreferrer">
      latest release
    </a>{' '}
    on the phone itself and tap the <span className="data">PayRecord-vX.Y.Z.apk</span> asset.
  </>,
  <>When Android asks, allow your browser to install unknown apps. This is a one-time prompt.</>,
  <>
    Open PayRecord and sign in. On the phone that receives your payment notifications, also grant <em>Notification access</em>{' '}
    when the app asks.
  </>,
  <>To update later, install the newer APK over the old one — your data is kept, because the signing key is the same.</>,
];

/** Which phones a seller actually needs, by situation. */
const scenarios = [
  {
    have: 'An Android phone',
    need: 'That phone is enough',
    detail: 'It scans confirmations and collects your payment notifications at the same time. Nothing to pair.',
    ok: true,
  },
  {
    have: 'An iPhone at the counter',
    need: 'Plus any Android phone',
    detail: 'The Android phone receives the notifications and can sit anywhere with internet. Paired once with a 5-minute code.',
    ok: true,
  },
  {
    have: 'Only iPhones',
    need: 'Manual confirmation only',
    detail: 'iOS does not let apps read other apps’ notifications. You can record and confirm by hand, but nothing will auto-match.',
    ok: false,
  },
];

const requirements: [string, string][] = [
  ['Permissions', 'Camera, to scan payment confirmations. On the Android payment phone only, Notification Access. Revoke either at any time.'],
  [
    'What leaves the phone',
    'Only positive incoming-payment notifications from wallets you enable. OTPs, security prompts, outgoing payments and promos are dropped on the device.',
  ],
  ['Plans', 'Free includes the remote payment-phone workflow, CSV export and the full evidence trail. Paid plans add capacity, devices and staff.'],
];

export default function Download() {
  const rel = latest();

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Downloads"
        title="Get PayRecord"
        aside={
          <span className="pill bg-warn-soft text-warn">
            {rel.channel} v{rel.version}
          </span>
        }
        lead={
          <>
            Android is the phone that receives your payment notifications, so it is the one build that matters right now.{' '}
            <Link href={`/updates#v${rel.version}`} className="ul">
              See what changed in v{rel.version}
            </Link>
            .
          </>
        }
      />

      {/* ── Primary: the only build you can actually install today ───────── */}
      <div className="mt-14 grid gap-6 lg:grid-cols-[1.45fr_1fr] lg:gap-8">
        <div className="card-raised overflow-hidden">
          <div className="border-b border-line bg-brand-soft/40 px-7 py-6 sm:px-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="h-section text-[1.9rem] leading-none">Android</h2>
                <span className="pill bg-brand-soft text-brand-2">Start here</span>
              </div>
              <span className="data text-[11px] text-ink-3">{DOWNLOADS.android.minOs}</span>
            </div>
            <p className="mt-3 max-w-lg text-[15px] leading-7 text-ink-2">
              Required for the phone that receives your GCash, GoTyme or Maya notifications. It scans payment confirmations
              too, so one Android phone can do the whole job.
            </p>
          </div>

          <div className="px-7 py-7 sm:px-9">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
              <a href={DOWNLOADS.android.apkUrl} rel="noreferrer" className="btn-primary">
                Download the APK <span aria-hidden>↓</span>
              </a>
              <div className="text-[13px] leading-6 text-ink-3">
                <p className="font-medium text-ink-2">Signed release build</p>
                <p>
                  <span className="data">v{rel.version}</span> · from GitHub Releases
                </p>
              </div>
            </div>

            <p className="mt-6 border-t border-line pt-5 text-[13.5px] leading-6 text-ink-3">
              The Google Play listing is still in review, so the direct APK is the way in for now.
            </p>

            {/* Install steps are the most important content on this page for a
                beta APK, so they stay open rather than hidden in a disclosure. */}
            <div className="mt-7 border-t border-line pt-7">
              <p className="eyebrow">Installing</p>
              <ol className="mt-5 space-y-4">
                {installSteps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="data mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-bg-2 text-[11px] font-semibold text-ink-3">
                      {i + 1}
                    </span>
                    <p className="text-[14.5px] leading-7 text-ink-2">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* ── Secondary: honest about not existing yet ────────────────────── */}
        <div className="card p-7 sm:p-9 lg:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="h-section text-[1.5rem] leading-none text-ink-2">iPhone</h2>
            <span className="data text-[11px] text-ink-3">{DOWNLOADS.ios.minOs}</span>
          </div>
          <span className="pill mt-4 self-start bg-bg-2 text-ink-3">Not yet available</span>

          <p className="mt-5 text-[14.5px] leading-7 text-ink-2">
            The iPhone build scans confirmations, reviews matches and shows the dashboard. It cannot read other apps&apos;
            notifications — iOS does not allow it — so it always needs an Android payment phone alongside it, or manual
            confirmation.
          </p>

          <dl className="mt-7 space-y-3 border-t border-line pt-6 text-[13.5px]">
            {[
              ['App Store', DOWNLOADS.ios.appStoreUrl ? 'Available' : 'Not submitted yet'],
              ['TestFlight', DOWNLOADS.ios.testFlightUrl ? 'Open' : 'Opens with the first iOS build'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-right text-ink-3">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-7 border-t border-line pt-6 text-[13px] leading-6 text-ink-3">
            Want to know when it lands?{' '}
            <a className="ul" href="mailto:support@payrecord.ph?subject=iOS%20beta">
              Email us
            </a>
            .
          </p>
        </div>
      </div>

      {/* ── The question people actually arrive with ──────────────────────── */}
      <div className="mt-20 border-t border-line pt-14">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <p className="eyebrow">Before you install</p>
            <h2 className="h-section mt-3 text-[clamp(1.6rem,3.5vw,2.2rem)] leading-tight">Which phones do you need?</h2>
            <p className="mt-5 leading-7 text-ink-2">
              Automatic matching depends on one thing: an Android phone that receives your payment notifications. Everything
              else is a preference.
            </p>
          </div>

          <ul>
            {scenarios.map((s) => (
              <li
                key={s.have}
                className="grid gap-x-6 gap-y-3 border-t border-line py-6 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_1.3fr]"
              >
                <div>
                  <p className="eyebrow">You have</p>
                  <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]">{s.have}</p>
                </div>
                <div>
                  <span className={`pill ${s.ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{s.need}</span>
                  <p className="mt-3 text-[14px] leading-6 text-ink-2">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Spec strip ────────────────────────────────────────────────────── */}
      <div className="mt-16 grid gap-8 border-t border-line pt-10 sm:grid-cols-3 sm:gap-10">
        {requirements.map(([h, b]) => (
          <div key={h}>
            <p className="eyebrow">{h}</p>
            <p className="mt-3 text-[13.5px] leading-7 text-ink-2">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
