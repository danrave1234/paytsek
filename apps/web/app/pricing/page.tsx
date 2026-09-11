import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Public beta',
  description: 'PayTsek is free to use during public beta. Capture and compile QR payment records faster.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return <>
    <section className="mx-auto max-w-5xl px-4 pb-14 pt-14 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow text-brand">Public beta</p>
        <h1 className="h-display mt-4 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02]">Use PayTsek free while we make it better.</h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-ink-2">There is no checkout, subscription, automatic charge, or payment volume fee during beta. The goal is simple: capture payment proof and compile the day without digging through screenshots.</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
        {[
          ['Capture', 'Scan a customer confirmation or import a receipt screenshot.'],
          ['Compile', 'Every saved record counts in today’s total, even while it awaits verification.'],
          ['Verify later', 'Match payment-phone notifications when available, without slowing down recording.'],
        ].map(([title, body], index) => <article key={title} className="card-raised p-6"><p className="data text-sm text-brand">0{index + 1}</p><h2 className="mt-5 text-xl font-semibold tracking-[-.03em]">{title}</h2><p className="mt-3 text-sm leading-6 text-ink-2">{body}</p></article>)}
      </div>
      <div className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/download" className="btn-primary">Download for Android</Link>
        <Link href="/support" className="btn-secondary">Ask a question</Link>
      </div>
    </section>
    <section className="border-y border-line bg-bg py-14">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6"><p className="eyebrow text-brand">What happens next</p><h2 className="h-section mt-4 text-3xl">Pricing is not active yet.</h2><p className="mt-5 text-[15.5px] leading-7 text-ink-2">If paid plans are introduced later, we will announce the change in the app and on this page before charging anyone. Beta access does not require a card or payment account.</p></div>
    </section>
  </>;
}
