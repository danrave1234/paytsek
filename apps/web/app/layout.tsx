import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { latest } from '@/lib/releases';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz', 'SOFT'], display: 'swap' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'PayRecord — a paper trail for GCash & GoTyme payments', template: '%s · PayRecord' },
  description: 'Scan a payment proof, keep an organized record, and match it with incoming-payment evidence from your own Android phone. Built for Philippine sellers.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://payrecord.ph'),
  openGraph: { title: 'PayRecord', description: 'A paper trail for GCash & GoTyme payments.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#f4efe6', width: 'device-width', initialScale: 1 };

const nav = [
  { href: '/updates', label: 'Updates' },
  { href: '/download', label: 'Download' },
  { href: '/support', label: 'Support' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const rel = latest();
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <header className="border-b-2 border-ink">
          <div className="mx-auto flex max-w-6xl items-stretch justify-between px-4">
            <Link href="/" className="flex items-center gap-3 py-4 pr-6 sm:border-r border-rule">
              <span aria-hidden className="grid size-9 place-items-center border-2 border-ink font-display text-xl font-semibold leading-none">₱</span>
              <span className="leading-tight">
                <span className="block font-display text-xl font-semibold tracking-tight">PayRecord</span>
                <span className="eyebrow block">Est. 2026 · Manila</span>
              </span>
            </Link>
            <nav aria-label="Main" className="flex items-center gap-5 font-mono text-[13px] uppercase tracking-[0.14em]">
              {nav.map((n, i) => (
                <Link key={n.href} href={n.href} className="hidden py-4 hover:text-stamp sm:block">
                  <span className="mr-1.5 text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  {n.label}
                </Link>
              ))}
              <Link href="/download" className="my-3 bg-ink px-3 py-2 text-paper hover:bg-stamp">
                Get v{rel.version}
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-24 border-t-2 border-dashed border-rule">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="font-display text-2xl font-semibold">PayRecord</p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-ink-2">
                Recordkeeping for sellers who get paid through GCash and GoTyme. We never touch the money. Not affiliated with, endorsed by, or verified by GCash, GoTyme, or any bank.
              </p>
            </div>
            <div className="text-sm">
              <p className="eyebrow mb-3">Legal</p>
              <ul className="space-y-2">
                <li><Link className="ul" href="/privacy">Privacy policy</Link></li>
                <li><Link className="ul" href="/terms">Terms of use</Link></li>
                <li><Link className="ul" href="/support">Support &amp; account deletion</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="eyebrow mb-3">Product</p>
              <ul className="space-y-2">
                <li><Link className="ul" href="/updates">Release notes</Link></li>
                <li><Link className="ul" href="/download">Downloads</Link></li>
                <li><a className="ul" href="https://github.com/danrave1234/pay_record/releases" rel="noreferrer">GitHub releases</a></li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            <span>*** Thank you for keeping records ***</span>
            <span>v{rel.version} · {rel.date}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
