import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAN_LIMITS } from '@paytsek/contracts';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple PayTsek pricing for QR payment records: Free, Starter, and Business.',
  alternates: { canonical: '/pricing' },
};

const plans = [PLAN_LIMITS.FREE, PLAN_LIMITS.STARTER, PLAN_LIMITS.BUSINESS];

function price(centavos: number) {
  return centavos === 0 ? 'Free' : `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;
}

export default function PricingPage() {
  return <>
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow text-brand">Simple, predictable billing</p>
        <h1 className="h-display mt-4 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02]">Pay for records, not payment volume.</h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-ink-2">Every plan includes the Android scanner, proof records, matching evidence and your web dashboard. PayTsek never takes a cut of your customers&apos; payments.</p>
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => <article key={plan.code} className={`card-raised flex flex-col p-6 ${plan.code === 'STARTER' ? 'border-brand/35 ring-1 ring-brand/15' : ''}`}>
          <div className="flex items-center justify-between gap-3"><p className="eyebrow">{plan.code === 'STARTER' ? 'Most practical' : 'PayTsek plan'}</p>{plan.code === 'STARTER' ? <span className="pill bg-brand-soft text-brand">Recommended</span> : null}</div>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-.03em]">{plan.displayName}</h2>
          <p className="data mt-5 text-3xl font-semibold">{price(plan.proposedMonthlyPriceCentavos)}{plan.proposedMonthlyPriceCentavos > 0 ? <span className="ml-1 text-sm font-medium text-ink-2">/ 30 days</span> : null}</p>
          <p className="mt-3 text-sm leading-6 text-ink-2">{plan.monthlyRecordAllowance.toLocaleString('en-PH')} new payment records per billing period.</p>
          <ul className="mt-6 space-y-3 border-t border-line pt-6 text-sm text-ink-2">
            <li>{plan.scannerDevices} scanner {plan.scannerDevices === 1 ? 'device' : 'devices'}</li>
            <li>{plan.collectorDevices} notification phone {plan.collectorDevices === 1 ? 'connection' : 'connections'}</li>
            <li>{plan.receivingSources} receiving {plan.receivingSources === 1 ? 'source' : 'sources'}</li>
            <li>Up to {plan.members} team members</li>
            <li>{plan.proofImageRetentionDays}-day proof retention</li>
          </ul>
          <Link href={plan.code === 'FREE' ? '/download' : '/dashboard'} className={`mt-8 ${plan.code === 'STARTER' ? 'btn-primary' : 'btn-secondary'}`}>{plan.code === 'FREE' ? 'Download for Android' : 'Choose in dashboard'}</Link>
        </article>)}
      </div>
    </section>
    <section className="border-y border-line bg-bg py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div><p className="eyebrow text-brand">How billing works</p><h2 className="h-section mt-4 text-3xl">Clear before you pay.</h2><p className="mt-5 text-[15.5px] leading-7 text-ink-2">Workspace owners choose a plan from the dashboard, then pay in PayMongo&apos;s secure hosted checkout. Access starts only after PayMongo confirms payment.</p></div>
        <ol className="grid gap-3 sm:grid-cols-3">{[['1', 'Choose a plan', 'The owner selects Starter or Business.'], ['2', 'Approve QRPh', 'Pay every 30 days only when you choose.'], ['3', 'Keep your time', 'Early renewal extends from your existing end date.']].map(([number, title, body]) => <li key={number} className="rounded-2xl border border-line bg-bg px-5 py-5"><span className="data text-sm text-brand">{number}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-2">{body}</p></li>)}</ol>
      </div>
    </section>
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6"><h2 className="h-section text-2xl">About automatic monthly renewal</h2><p className="mt-4 text-[15.5px] leading-7 text-ink-2">QRPh is an approval-per-payment method, so PayTsek cannot automatically charge it later. When recurring billing is enabled with a compatible PayMongo payment method, it will show the price, next charge date and a one-tap cancellation control before you opt in.</p><Link href="/support" className="ul mt-6 inline-block text-sm">Questions about billing?</Link></section>
  </>;
}
