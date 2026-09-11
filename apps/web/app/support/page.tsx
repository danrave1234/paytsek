import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Support', description: 'Help, FAQ and account deletion for PayTsek.' };

/** Grouped so people can find their own situation instead of reading it all. */
const groups = [
  {
    id: 'payments',
    title: 'A payment looks wrong',
    lead: 'The most common reason to open this page.',
    faq: [
      {
        q: 'A payment shows "Unverified" but the customer paid. Is it lost?',
        a: 'No. Unverified only means no notification has been associated yet. Check that the Android payment phone is on, connected, and still has Notification Access enabled — Settings → Devices & health will tell you. An owner can also confirm manually after checking the wallet app directly.',
      },
      {
        q: 'Why didn’t a payment auto-match, even though the amount and time agree?',
        a: 'By design. Amount plus time alone never confirms a payment, because several customers can pay the same amount at the same moment. Automatic matching needs the same reference number on both the customer’s confirmation screen and your notification, on a supported flow. Everything else goes to Review, where you decide.',
      },
      {
        q: 'What happens when I reach my monthly record limit?',
        a: 'There is no paid record limit during public beta. Save the payment first; verification can happen afterwards when a notification is available.',
      },
    ],
  },
  {
    id: 'phones',
    title: 'Phones and wallets',
    lead: 'What each device and wallet can actually do.',
    faq: [
      {
        q: 'Can my iPhone read GCash notifications?',
        a: 'No. iOS does not allow apps to read other apps’ notifications, and PayTsek does not claim otherwise. Use the iPhone to scan and review, and pair an Android phone that receives your payment notifications — or use manual confirmation.',
      },
      {
        q: 'Which wallets auto-match?',
        a: 'GCash → GCash Express Send is enabled when an exact comparable reference is present. GoTyme, Maya and MariBank incoming notifications are recognised, then sent to Review because those templates do not contain a comparable reference. The support table on the home page is generated from the app’s own capability registry, so it is always current.',
      },
      {
        q: 'Does PayTsek see my balance or MPIN?',
        a: 'Never. It only reads the incoming-payment notifications you allow, and never asks for wallet credentials, MPIN, or OTPs. Nobody from PayTsek will ever ask you for them either.',
      },
    ],
  },
];

const deleteSteps: ReactNode[] = [
  <>
    Open PayTsek → <strong className="font-semibold text-ink">Settings → Privacy &amp; data</strong>.
  </>,
  <>
    Tap <em>Export my personal data</em> if you want a copy first. The download link is valid for 24 hours.
  </>,
  <>
    Tap <em>Delete my account</em> and type DELETE. Sole workspace owners must transfer ownership or delete the workspace
    first, so business records are never silently orphaned.
  </>,
  <>
    Cannot sign in any more? Email{' '}
    <a className="ul" href="mailto:support@paytsek.online?subject=Account%20deletion">
      support@paytsek.online
    </a>{' '}
    from the account address and we will complete the deletion within 30 days.
  </>,
];

export default function Support() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:py-20">
      <PageHeader
        eyebrow="Help desk"
        title="Support"
        lead={
          <>
            Email{' '}
            <a className="ul" href="mailto:support@paytsek.online">
              support@paytsek.online
            </a>{' '}
            with your workspace name and app version (Settings → bottom of the screen).{' '}
            <span className="text-ink">Never send your MPIN, OTP or wallet password</span> — we will never ask for them.
          </>
        }
      />

      <a href="mailto:support@paytsek.online?subject=PayTsek%20support" className="btn-primary mt-7 inline-flex">Email PayTsek support</a>

      {/* ── Triage: send people to the right place before they start reading ── */}
      <nav aria-label="Jump to" className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ...groups.map((g) => ({ href: `#${g.id}`, title: g.title, lead: g.lead })),
          { href: '#delete', title: 'Delete my account', lead: 'Export first, then remove everything.' },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card group px-5 py-5 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
          >
            <p className="text-[15px] font-semibold leading-snug tracking-[-0.02em] transition-colors group-hover:text-brand-2">
              {c.title}
            </p>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-3">{c.lead}</p>
          </Link>
        ))}
      </nav>

      {/* ── FAQ, grouped ──────────────────────────────────────────────────── */}
      {groups.map((g) => (
        <div key={g.id} id={g.id} className="mt-20 scroll-mt-28">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-5">
            <h2 className="h-section text-[clamp(1.5rem,3.5vw,2rem)] leading-tight">{g.title}</h2>
            <p className="eyebrow">
              {g.faq.length} question{g.faq.length === 1 ? '' : 's'}
            </p>
          </div>

          <dl>
            {g.faq.map((f, i) => (
              <div key={f.q} className="grid gap-x-6 gap-y-3 border-b border-line py-7 sm:grid-cols-[3rem_1fr]">
                <p className="data text-[13px] text-brand">{String(i + 1).padStart(2, '0')}</p>
                <div>
                  <dt className="text-[1.1rem] font-semibold leading-snug tracking-[-0.02em]">{f.q}</dt>
                  <dd className="mt-3 max-w-2xl text-[15px] leading-8 text-ink-2">{f.a}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {/* ── Account deletion: a store requirement, so it gets real weight ─── */}
      <div id="delete" className="mt-20 scroll-mt-28">
        <div className="card-raised overflow-hidden">
          <div className="border-b border-line bg-bg-2 px-7 py-6 sm:px-9">
            <h2 className="h-section text-[clamp(1.5rem,3.5vw,2rem)] leading-tight">Delete your account or data</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-2">
              You can do this yourself from inside the app. Export a copy first if you want to keep your records.
            </p>
          </div>

          <div className="px-7 py-7 sm:px-9">
            <ol className="space-y-5">
              {deleteSteps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="data mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-bg-2 text-[11px] font-semibold text-ink-3">
                    {i + 1}
                  </span>
                  <p className="text-[14.5px] leading-7 text-ink-2">{step}</p>
                </li>
              ))}
            </ol>

            <p className="mt-7 border-t border-line pt-6 text-[13.5px] leading-7 text-ink-3">
              Deletion removes your profile, memberships and personal data. Business records you created stay with the
              workspace without your name attached, as the owner needs them for their own recordkeeping. See the{' '}
              <Link className="ul" href="/privacy">
                privacy policy
              </Link>{' '}
              for exact retention periods.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
