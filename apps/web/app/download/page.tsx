import type { Metadata } from 'next';
import Link from 'next/link';
import { DOWNLOADS, latest } from '@/lib/releases';

export const metadata: Metadata = { title: 'Download', description: 'Get PayRecord for Android and iPhone.' };

function Store({ label, href, note }: { label: string; href: string | null; note?: string }) {
  if (!href) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted dark:border-slate-700 dark:text-slate-400">
        <p className="font-medium text-ink dark:text-slate-200">{label}</p>
        <p className="mt-1">Not yet available. {note ?? 'Check back after store approval.'}</p>
      </div>
    );
  }
  return (
    <a href={href} className="block rounded-xl bg-brand p-4 text-white hover:bg-brand-dark" rel="noreferrer">
      <p className="font-medium">{label}</p>
      {note ? <p className="mt-1 text-sm text-white/85">{note}</p> : null}
    </a>
  );
}

export default function Download() {
  const rel = latest();
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Download PayRecord</h1>
      <p className="mt-2 text-muted dark:text-slate-300">Latest version {rel.version} ({rel.channel}) · <Link href={`/updates#v${rel.version}`} className="underline">release notes</Link></p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="rounded-2xl border border-line p-6 dark:border-slate-800">
          <h2 className="text-xl font-semibold">Android</h2>
          <p className="mt-1 text-sm text-muted dark:text-slate-300">{DOWNLOADS.android.minOs}. Required for the payment phone that receives GCash notifications; also scans receipts.</p>
          <div className="mt-4 space-y-3">
            <Store label="Get it on Google Play" href={DOWNLOADS.android.playStoreUrl} />
            <Store label="Direct APK (beta testers)" href={DOWNLOADS.android.apkUrl} note="Signed release build for closed beta. Verify the SHA-256 shown on this page before installing." />
          </div>
        </div>
        <div className="rounded-2xl border border-line p-6 dark:border-slate-800">
          <h2 className="text-xl font-semibold">iPhone</h2>
          <p className="mt-1 text-sm text-muted dark:text-slate-300">{DOWNLOADS.ios.minOs}. Scans receipts, reviews matches, and shows the dashboard. iPhone cannot read other apps&apos; notifications, so pair an Android payment phone or use manual confirmation.</p>
          <div className="mt-4 space-y-3">
            <Store label="Download on the App Store" href={DOWNLOADS.ios.appStoreUrl} />
            <Store label="Join the TestFlight beta" href={DOWNLOADS.ios.testFlightUrl} />
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-2xl bg-slate-50 p-6 text-sm dark:bg-slate-900/50">
        <h2 className="font-semibold">Before you install</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted dark:text-slate-300">
          <li>PayRecord asks for camera access to scan receipts and, on the Android payment phone only, for Notification Access. You can revoke either at any time.</li>
          <li>Only positive incoming-payment notifications from the wallet apps you enable are uploaded. OTPs, security prompts, outgoing payments and promos are dropped on the phone.</li>
          <li>The Free plan includes the remote payment-phone workflow. Paid plans add capacity, devices, staff and longer image retention.</li>
        </ul>
      </div>
    </section>
  );
}
