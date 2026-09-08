import type { Metadata } from 'next';
import Link from 'next/link';
import { DOWNLOADS, GITHUB_RELEASES_URL, latest } from '@/lib/releases';

export const metadata: Metadata = { title: 'Download', description: 'Get PayRecord for Android and iPhone.' };

function Row({ label, href, note }: { label: string; href: string | null; note?: string }) {
  if (!href) {
    return (
      <div className="flex items-start justify-between gap-4 border-t border-dashed border-rule py-4">
        <div>
          <p className="font-medium text-ink-3 line-through decoration-rule">{label}</p>
          <p className="mt-1 text-sm text-ink-3">Not yet available. {note ?? 'Check back after store approval.'}</p>
        </div>
        <span className="eyebrow shrink-0 pt-1">pending</span>
      </div>
    );
  }
  return (
    <a href={href} rel="noreferrer" className="group flex items-start justify-between gap-4 border-t border-dashed border-rule py-4 hover:bg-paper-2/70">
      <div>
        <p className="font-medium group-hover:text-stamp">{label}</p>
        {note ? <p className="mt-1 text-sm text-ink-2">{note}</p> : null}
      </div>
      <span aria-hidden className="shrink-0 font-mono text-xl leading-none transition-transform group-hover:translate-x-1">→</span>
    </a>
  );
}

export default function Download() {
  const rel = latest();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <p className="eyebrow">Downloads</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Get PayRecord</h1>
      <p className="mt-4 max-w-2xl leading-7 text-ink-2">
        Latest build <span className="font-mono">v{rel.version}</span> ({rel.channel}) · <Link href={`/updates#v${rel.version}`} className="ul">release notes</Link>. Android is the phone that receives GCash notifications; iPhone records and reviews.
      </p>

      <div className="mt-12 grid gap-px bg-ink lg:grid-cols-2">
        <div className="bg-paper p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold">Android</h2>
            <span className="font-mono text-xs text-ink-3">{DOWNLOADS.android.minOs}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-2">Required for the payment phone that receives GCash notifications; also scans receipts. Not on Expo Go — this is a full native build.</p>
          <div className="mt-6 border-b border-dashed border-rule">
            <Row label="Google Play" href={DOWNLOADS.android.playStoreUrl} note="Store listing is in review." />
            <Row label="Direct APK · GitHub release" href={DOWNLOADS.android.apkUrl} note="Signed release build. Download the .apk asset, allow “install unknown apps” for your browser, then open it." />
          </div>
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.18em] text-ink-3 hover:text-ink">Install instructions</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-6 text-ink-2">
              <li>Open the <a className="ul" href={`${GITHUB_RELEASES_URL}/latest`} rel="noreferrer">latest release</a> on your phone and tap the <span className="font-mono">PayRecord-vX.Y.Z.apk</span> asset.</li>
              <li>When Android asks, allow your browser to install unknown apps (one-time).</li>
              <li>Open PayRecord, sign in, then grant <em>Notification access</em> in Settings on the phone that receives GCash notifications.</li>
              <li>Updating: install the newer APK over the old one — data is kept because the signing key is the same.</li>
            </ol>
          </details>
        </div>

        <div className="bg-paper p-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold">iPhone</h2>
            <span className="font-mono text-xs text-ink-3">{DOWNLOADS.ios.minOs}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-2">Scans receipts, reviews matches, and shows the dashboard. iPhone cannot read other apps&apos; notifications, so pair an Android payment phone or use manual confirmation.</p>
          <div className="mt-6 border-b border-dashed border-rule">
            <Row label="App Store" href={DOWNLOADS.ios.appStoreUrl} />
            <Row label="TestFlight beta" href={DOWNLOADS.ios.testFlightUrl} note="Opens once the first iOS build is uploaded." />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {[
          ['Permissions', 'Camera to scan receipts; on the Android payment phone only, Notification Access. Revoke either at any time.'],
          ['What leaves the phone', 'Only positive incoming-payment notifications from wallet apps you enable. OTPs, security prompts, outgoing payments and promos are dropped on the device.'],
          ['Plans', 'Free includes the remote payment-phone workflow. Paid plans add capacity, devices, staff and longer image retention.'],
        ].map(([h, b]) => (
          <div key={h} className="border-t-2 border-ink pt-4">
            <p className="eyebrow">{h}</p>
            <p className="mt-2 text-sm leading-6 text-ink-2">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
